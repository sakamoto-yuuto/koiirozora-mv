// Incremental film render: the film is cut into fixed PIECES (per section, long sections split into pieces of at most
// --piece seconds). Each piece is rendered once into out/_segments/<W>x<H>_<FPS>/ and kept with a FINGERPRINT of
// everything that can change its pixels; a piece whose fingerprint is unchanged is reused. The pieces are joined
// losslessly and the audio (config.json -> paths.audio, i.e. the current mix) is muxed once over the whole range.
// A frame is a pure function of its time (renderFrame(t)), so pieces rendered separately join without seams.
//
//   node tools/render_film.mjs [--start 0] [--end 395.4] [--width 1280 --height 720 --fps 30] [--jobs 3]
//                              [--out out/film.mp4] [--dry] [--force] [--piece 16]
//   --dry    list the pieces and which ones would be rendered, render nothing
//   --force  render every piece of the range again
//
// The fingerprint of a piece = render size / fps / codec + the content of
//   - the shared code: the static-import closure of src/main.js, src/engine/engine.js, src/scenes/index.js, plus
//     index.html, export/export.mjs, config.json, data/lyrics_film.json, data/audio_features.json, the fonts
//   - the import closure of the piece's section file (scene files import from each other); for the first piece of a
//     section also the previous section's, for the last piece also the next one's (a lead-in can reach over a cut)
//   - every picture in assets/art and assets/plates whose name starts with a string literal of those files
//     (`y_walk_${f}` -> every y_walk_* picture)
// When a change is not caught (a new kind of input), --force the pieces concerned.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; }, flag = (k) => argv.includes('--' + k);
const FPS = +arg('fps', 30), W = +arg('width', 1280), H = +arg('height', 720), JOBS = +arg('jobs', 3), PIECE = +arg('piece', 16);
const DUR = JSON.parse(fs.readFileSync(path.join(ROOT, cfg.paths.features), 'utf8')).meta.duration;
const START = +arg('start', 0), END = Math.min(+arg('end', DUR), DUR), OUT = path.resolve(ROOT, arg('out', 'out/film.mp4'));
const CODEC = arg('codec', cfg.export.codec);
const ffmpeg = path.resolve(arg('ffmpeg', process.env.MV_FFMPEG || createRequire(import.meta.url)('ffmpeg-static')));

// ---- the sections: [start, file]. Boundaries sit where one section file's shots hand over to the next. -------------
const SECTIONS = [
  [0, '01_intro'], [75.41, '02_v1'], [101.01, '03_b1'], [122.61, '04_c1'], [173.81, '05_brk'], [186.61, '06_v2'],
  [212.21, '07_b2'], [234.61, '08_c2'], [273.01, '09_bridge'], [295.41, '10_c3'], [320.07, '11_koi'], [333.81, '12_outro'],
];

// ---- fingerprints ---------------------------------------------------------------------------------------------------
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const read = (p) => { try { return fs.readFileSync(p); } catch { return null; } };
function closure(files) {
  const seen = new Set(), stack = files.map((f) => path.resolve(ROOT, f));
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) stack.push(path.resolve(path.dirname(f), m[1]));
  }
  return [...seen].sort();
}
const ASSETS = ['assets/art', 'assets/plates'].flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter((n) => /\.(png|json)$/.test(n)).map((n) => path.join(ROOT, d, n)) : []));
function assetsOf(files) {
  const tokens = new Set();
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"`]([a-z][a-z0-9]*_[a-z0-9_]*)/g)) tokens.add(m[1]);
  return ASSETS.filter((a) => { const b = path.basename(a).replace(/\.(png|json)$/, ''); for (const t of tokens) if (b.startsWith(t)) return true; return false; });
}
const hashFiles = (h, files) => { for (const f of files) { h.update(rel(f)); h.update(read(f) ?? Buffer.from('missing')); } };
const FONT_DIR = path.join(ROOT, 'assets/fonts');
const SHARED = [
  ...closure(['src/main.js', 'src/engine/engine.js', 'src/scenes/index.js']),
  ...['index.html', 'export/export.mjs', 'config.json', cfg.paths.lyrics, cfg.paths.features].map((f) => path.join(ROOT, f)),
  ...(fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR).map((n) => path.join(FONT_DIR, n)) : []),
];
const sharedHash = (() => { const h = crypto.createHash('sha1'); h.update(`${W}x${H}@${FPS}|${CODEC}`); hashFiles(h, SHARED); return h.digest('hex'); })();
// a piece's own section always counts; the previous section only for its FIRST piece and the next one only for its
// LAST piece (a lead-in or transition reaches over the cut, never further)
function pieceKey(si, first, last) {
  const ks = [si, ...(first && si > 0 ? [si - 1] : []), ...(last && si + 1 < SECTIONS.length ? [si + 1] : [])];
  const files = closure(ks.map((k) => `src/scenes/${SECTIONS[k][1]}.js`));
  const h = crypto.createHash('sha1'); h.update(sharedHash); hashFiles(h, files); hashFiles(h, assetsOf(files));
  return h.digest('hex').slice(0, 16);
}

// ---- the pieces ------------------------------------------------------------------------------------------------------
const pieces = [];
SECTIONS.forEach(([s, file], si) => {
  const e = si + 1 < SECTIONS.length ? SECTIONS[si + 1][0] : DUR, a0 = Math.round(s * FPS), b0 = Math.round(e * FPS);
  const n = Math.max(1, Math.ceil((b0 - a0) / (PIECE * FPS)));
  for (let k = 0; k < n; k++) {
    const a = a0 + Math.round(((b0 - a0) * k) / n), b = a0 + Math.round(((b0 - a0) * (k + 1)) / n);
    pieces.push({ file, a, b, key: pieceKey(si, k === 0, k === n - 1) });
  }
});
const f0 = Math.round(START * FPS), f1 = Math.round(END * FPS);
const want = pieces.filter((p) => p.b > f0 && p.a < f1);
const dir = path.join(ROOT, 'out', '_segments', `${W}x${H}_${FPS}`);
fs.mkdirSync(dir, { recursive: true });
for (const p of want) {
  p.out = path.join(dir, `${String(p.a).padStart(6, '0')}-${String(p.b).padStart(6, '0')}.mp4`);
  const old = read(p.out + '.key');
  p.stale = flag('force') || !fs.existsSync(p.out) || !old || String(old) !== p.key;
}
const stale = want.filter((p) => p.stale);
console.log(`[film] ${want.length} pieces in ${(want[0].a / FPS).toFixed(2)}..${(want.at(-1).b / FPS).toFixed(2)} s, ${stale.length} to render (${(stale.reduce((s, p) => s + p.b - p.a, 0) / FPS).toFixed(1)} s of film)`);
for (const p of want) console.log(`  ${p.stale ? 'RENDER' : 'reuse '}  ${(p.a / FPS).toFixed(2).padStart(7)} - ${(p.b / FPS).toFixed(2).padStart(7)}  ${p.file}`);
if (flag('dry')) process.exit(0);

// ---- render the stale pieces, JOBS at a time --------------------------------------------------------------------------
const t0 = Date.now();
let next = 0, failed = null;
async function worker() {
  while (next < stale.length && !failed) {
    const p = stale[next++];
    await new Promise((res) => {
      const tmp = p.out + '.part.mp4';
      const c = spawn(process.execPath, ['export/export.mjs', '--start', String(p.a / FPS), '--end', String(p.b / FPS), '--width', String(W), '--height', String(H), '--fps', String(FPS), '--codec', CODEC, '--cq', arg('cq', '20'), '--out', tmp], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      let last = '';
      c.stdout.on('data', (d) => { last = String(d).split('\r').filter(Boolean).pop() ?? last; });
      c.stderr.on('data', (d) => { last = String(d); });
      c.on('exit', (code) => {
        if (code === 0 && fs.existsSync(tmp)) { fs.rmSync(p.out, { force: true }); fs.renameSync(tmp, p.out); fs.writeFileSync(p.out + '.key', p.key); console.log(`  done  ${(p.a / FPS).toFixed(2)} - ${(p.b / FPS).toFixed(2)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
        else { failed = `${(p.a / FPS).toFixed(2)}-${(p.b / FPS).toFixed(2)}: ${last.trim().slice(-400)}`; }
        res();
      });
    });
  }
}
await Promise.all(Array.from({ length: Math.min(JOBS, stale.length) }, worker));
if (failed) { console.error(`[film] a piece failed (the others are kept; run again to retry): ${failed}`); process.exit(1); }

// ---- join + audio -------------------------------------------------------------------------------------------------------
const list = path.join(dir, '_list.txt'), vid = path.join(dir, '_video.mp4');
fs.writeFileSync(list, want.map((p) => `file '${p.out.replace(/\\/g, '/')}'`).join('\n'));
const run = (a) => { const r = spawnSync(ffmpeg, a, { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed: ' + a.join(' ')); };
run(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-c', 'copy', vid]);
const a = want[0].a / FPS, n = want.at(-1).b - want[0].a;
run(['-v', 'error', '-y', '-i', vid, '-ss', String(Math.max(0, a)), '-t', String(n / FPS), '-i', path.join(ROOT, cfg.paths.audio),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...cfg.export.audio, '-shortest', '-movflags', '+faststart', '-metadata', `comment=mv_start=${a.toFixed(6)}`, OUT]);
fs.rmSync(vid, { force: true });
console.log(`[film] wrote ${rel(OUT)} (${a.toFixed(2)}..${(a + n / FPS).toFixed(2)} s, ${n} frames) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
