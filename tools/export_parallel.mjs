// Parallel export: split [start, end) into N frame-exact chunks, render them in N processes at once (one headless Chrome
// each), concatenate the video losslessly, then mux the audio once over the whole range (no seams at the joins).
//   node tools/export_parallel.mjs --start 0 --end 395.4 --width 1280 --height 720 --fps 30 --jobs 4 --out out/film.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FPS = +arg('fps', 30), W = arg('width', '1280'), H = arg('height', '720'), JOBS = +arg('jobs', 4);
const START = +arg('start', 0), END = +arg('end', 395.4), OUT = path.resolve(ROOT, arg('out', 'out/film.mp4'));
const f0 = Math.round(START * FPS), f1 = Math.round(END * FPS), per = Math.ceil((f1 - f0) / JOBS);
const tmp = path.join(ROOT, 'out', '_chunks');
fs.mkdirSync(tmp, { recursive: true });
const bundledFfmpeg = createRequire(import.meta.url)('ffmpeg-static');
const ffmpeg = path.resolve(arg('ffmpeg', process.env.MV_FFMPEG || bundledFfmpeg));

const chunks = [];
for (let k = 0; k < JOBS; k++) {
  const a = f0 + k * per, b = Math.min(f1, a + per);
  if (a < b) chunks.push({ k, a, b, file: path.join(tmp, `c${String(k).padStart(2, '0')}.mp4`), last: '' });
}
const t0 = Date.now();
console.log(`[parallel] ${f1 - f0} frames in ${chunks.length} chunks of ~${per}`);
// live progress for tools/dashboard.html (out/progress.json, rewritten every second)
const PROG = path.join(ROOT, 'out', 'progress.json');
const writeProgress = (phase) => fs.writeFileSync(PROG, JSON.stringify({ phase, out: path.relative(ROOT, OUT), started: t0, now: Date.now(), fps: FPS, size: `${W}x${H}`, start: START, end: END,
  chunks: chunks.map((c) => { const m = /(\d+)\/(\d+) frames\s+([\d.]+) fps/.exec(c.last); return { k: c.k, from: c.a / FPS, to: c.b / FPS, total: c.b - c.a, done: c.done ? c.b - c.a : m ? +m[1] : 0, rate: m ? +m[3] : 0, ok: !!c.done }; }) }));
const pv = setInterval(() => writeProgress('render'), 1000);
const iv = setInterval(() => console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)} s | ` + chunks.map((c) => (/(\d+)\/(\d+) frames/.exec(c.last)?.[1] ?? '-')).join(' ')), 30000);
await Promise.all(chunks.map((c) => new Promise((res, rej) => {
  const p = spawn(process.execPath, ['export/export.mjs', '--start', String(c.a / FPS), '--end', String(c.b / FPS),
    '--width', W, '--height', H, '--fps', String(FPS), '--codec', arg('codec', cfg.export.codec), '--cq', arg('cq', '20'),
    '--pipeline', arg('pipeline', '1'), '--pbo', arg('pbo', '0'), '--skip-b-upload', arg('skip-b-upload', '1'), '--inflight', arg('inflight', '3'),
    '--yuv', arg('yuv', '0'),
    ...(arg('ffmpeg', null) ? ['--ffmpeg', arg('ffmpeg', null)] : []), '--out', c.file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => { c.last = String(d).split('\r').pop(); });
  p.stderr.on('data', (d) => { c.last = String(d); });
  p.on('exit', (code) => { c.done = code === 0; code === 0 ? res() : rej(new Error(`chunk ${c.k} failed: ${c.last}`)); });
})));
clearInterval(iv); clearInterval(pv); writeProgress('mux');
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, chunks.map((c) => `file '${c.file.replace(/\\/g, '/')}'`).join('\n'));
const run = (a) => { const r = spawnSync(ffmpeg, a, { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };
const vid = path.join(tmp, 'video.mp4');
run(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-c', 'copy', vid]);
run(['-v', 'error', '-y', '-i', vid, '-ss', String(Math.max(0, START)), '-t', String((f1 - f0) / FPS), '-i', path.join(ROOT, cfg.paths.audio),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...cfg.export.audio, '-shortest', '-movflags', '+faststart', OUT]);
for (const c of chunks) fs.rmSync(c.file, { force: true });
fs.rmSync(vid, { force: true });
writeProgress('done');
console.log(`[parallel] wrote ${path.relative(ROOT, OUT)} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
