// Offline exporter: headless Chrome (GPU) renders frame by frame, raw RGBA frames are
// streamed straight into ffmpeg's stdin (no image files on disk), audio is muxed from the wav.
//
//   video:  node export/export.mjs [--start s] [--end s] [--width w] [--height h] [--fps n]
//                                  [--out file.mp4] [--codec auto|h264_nvenc|libx264] [--ffmpeg path] [--cq n] [--headed]
//           Times are SONG time (audio start = 0). The film itself starts at -safety.preroll (config.json) with a
//           silent warning page, and that is where an export starts unless --start says otherwise; the audio is
//           then delayed by the same amount. The file records the song time of its first frame (mv_start=... in the
//           `comment` tag) so that tools/check_sync.py and tools/check_flash.py can report song times.
//   QA contact sheet (one PNG of stills, for checking shots without exporting a video):
//           node export/export.mjs --sheet out/qa.png --times 12.5,13,13.5 [--cols 4] [--width 960 --height 540]
//           node export/export.mjs --sheet out/qa.png --from 29.4 --to 44.6 --step 0.923
//   check cards (src/scenes/lab.js) instead of the film: add --lab <set>, e.g. --lab inks --times 0,1,2
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { ROOT, startServer } from './server.mjs';
import { frameSocketHandler } from './wsframes.mjs';

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const features = JSON.parse(fs.readFileSync(path.join(ROOT, cfg.paths.features), 'utf8'));

// ---- arguments -------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const SHEET = arg('sheet', null);
const RAW = arg('raw', null);                         // raw RGBA still(s), for byte-for-byte export regression checks
// --raw stays RGBA for the T09 regression path.  --raw-yuv is a diagnostic
// capture of the GPU-packed planes used by the T09b PSNR test.
const RAW_YUV = !!RAW && ['1', 'true', 'on', 'yes'].includes(String(arg('raw-yuv', '0')).toLowerCase());
const YUV = !SHEET && (!RAW || RAW_YUV) && ['1', 'true', 'on', 'yes'].includes(String(arg('yuv', '0')).toLowerCase());
const LAB = arg('lab', null);                         // --lab <set>: the check cards of src/scenes/lab.js, one per second from t = 0
const W = +arg('width', SHEET ? 960 : cfg.video.width), H = +arg('height', SHEET ? 540 : cfg.video.height), FPS = +arg('fps', cfg.video.fps);
const PRE = cfg.safety?.preroll ?? 0;                 // seconds of film before the song
const START = Math.max(-PRE, +arg('start', LAB ? 0 : -PRE)), END = Math.min(+arg('end', features.meta.duration), features.meta.duration);
const OUT = path.resolve(ROOT, SHEET || RAW || arg('out', `out/export_${W}x${H}_${FPS}.mp4`));
const firstFrame = Math.round(START * FPS), lastFrame = Math.round(END * FPS);   // [first, last)
if (W % 2 || H % 2) throw new Error('width/height must be even for yuv420p');

let times = null;                                    // sheet mode: explicit list of timestamps
if (SHEET || RAW) {
  if (arg('times')) times = arg('times').split(',').map(Number);
  else { times = []; for (let t = +arg('from', 0); t <= +arg('to', 10) + 1e-6; t += +arg('step', 1)) times.push(+t.toFixed(4)); }
}
const total = (SHEET || RAW) ? times.length : lastFrame - firstFrame;

// ---- ffmpeg ----------------------------------------------------------------------
function findFfmpeg() {
  const p = createRequire(import.meta.url)('ffmpeg-static');
  if (p && fs.existsSync(p)) return p;
  throw new Error('project ffmpeg-static binary not found. Run: node node_modules/ffmpeg-static/install.js');
}
const requestedFfmpeg = arg('ffmpeg', process.env.MV_FFMPEG || null);
const FFMPEG = path.resolve(requestedFfmpeg || findFfmpeg());
const ffVersion = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
if (ffVersion.error || ffVersion.status !== 0) throw new Error(`ffmpeg is not runnable: ${FFMPEG}`);
const encoders = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
console.log(`[export] ffmpeg: ${FFMPEG}`);
console.log(`[export] ${ffVersion.stdout.split(/\r?\n/)[0]}`);
console.log(`[export] encoders: h264_nvenc=${/\bh264_nvenc\b/.test(encoders.stdout)} libx264=${/\blibx264\b/.test(encoders.stdout)}`);

function pickCodec() {
  const want = arg('codec', cfg.export.codec);
  if (want !== 'auto' && want !== 'h264_nvenc') return want;
  // Real probe: encode a few frames at the target size. Fails if driver/GPU/resolution is unsupported.
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=black:s=${W}x${H}:r=${FPS}`,
    '-frames:v', '5', '-c:v', 'h264_nvenc', '-f', 'null', '-']);
  if (r.status === 0) return 'h264_nvenc';
  console.warn(`[export] NVENC probe failed (status ${r.status}); stderr follows:\n${String(r.stderr || '').trim()}`);
  console.warn('[export] FALLBACK: using libx264');
  return 'libx264';
}

/** --cq N overrides the quality value of the configured encoder args (smaller files for previews). */
function quality(list, flag) {
  const q = arg('cq', null), out = [...list], i = out.indexOf(flag);
  if (q != null && i >= 0) out[i + 1] = String(q);
  return out;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const rawIn = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', YUV ? 'yuv420p' : 'rgba', '-s', `${W}x${H}`];
let ffArgs, CODEC = 'png', ff = null, ffDone = Promise.resolve(), rawOut = null, rawDone = Promise.resolve();
if (SHEET) {
  const cols = +arg('cols', 4), rows = Math.ceil(total / cols);
  ffArgs = [...rawIn, '-framerate', '1', '-i', 'pipe:0', '-vf', `tile=${cols}x${rows}:padding=6:color=0x303030`, '-frames:v', '1', OUT];
} else if (!RAW) {
  CODEC = pickCodec();
  // audio: the song from max(0, start); if the export starts before the song, it is delayed by that lead (in samples: exact)
  const lead = Math.max(0, -firstFrame / FPS), aStart = Math.max(0, firstFrame / FPS);
  ffArgs = [
    ...rawIn, '-framerate', String(FPS), '-thread_queue_size', '64', '-i', 'pipe:0',
    '-ss', String(aStart), '-t', String(total / FPS - lead), '-i', path.join(ROOT, cfg.paths.audio),
    '-map', '0:v', '-map', '1:a',
    ...(lead > 0 ? ['-af', `adelay=${Math.round(lead * features.meta.sampleRate)}S:all=1`] : []),
    '-metadata', `comment=mv_start=${(firstFrame / FPS).toFixed(6)}`,
    ...(YUV ? [] : ['-vf', 'scale=out_color_matrix=bt709:out_range=limited,format=yuv420p']),
    '-c:v', CODEC, ...(CODEC === 'h264_nvenc' ? quality(cfg.export.nvenc, '-cq') : quality(cfg.export.x264, '-crf')),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    ...cfg.export.audio, '-shortest', '-movflags', '+faststart', OUT,
  ];
}
if (ffArgs) {
  ff = spawn(FFMPEG, ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  ffDone = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  ff.stdin.on('error', (e) => { console.error('[ffmpeg stdin]', e.message); });
} else {
  rawOut = fs.createWriteStream(OUT);
  rawDone = new Promise((res, rej) => { rawOut.on('finish', res); rawOut.on('error', rej); });
}

// ---- frame sink: page -> WebSocket -> ffmpeg stdin (frames never touch the disk) ---
let received = 0, failed = null;
const onUpgrade = frameSocketHandler({
  frameBytes: W * H * (YUV ? 3 / 2 : 4),
  // Resolve once the sink accepts the frame. The browser may have a small bounded
  // queue in flight; wsframes keeps the actual writes ordered.
  onFrame: (frame) => new Promise((res, rej) => (ff ? ff.stdin : rawOut).write(frame, (e) => (e ? rej(e) : (received++, res())))),
  onError: (e) => { failed = e; },
});

// ---- browser ---------------------------------------------------------------------
const { server, url } = await startServer({ port: 5180, onUpgrade });
const gpuArgs = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
let browser;
for (const channel of [cfg.export.browserChannel, 'chrome', 'msedge', undefined]) {
  try { browser = await chromium.launch({ channel, headless: !argv.includes('--headed'), args: gpuArgs }); break; } catch { /* try next */ }
}
if (!browser) throw new Error('No Chrome/Edge found for Playwright (set export.browserChannel in config.json)');

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => { failed = e; console.error('[page error]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  const pass = (name) => `${name}=${encodeURIComponent(arg(name, name === 'pipeline' ? '1' : name === 'pbo' ? '0' : arg('inflight', '3')))}`;
  await page.goto(`${url}/?mode=export&w=${W}&h=${H}&${pass('pipeline')}&${pass('pbo')}&skipBUpload=${encodeURIComponent(arg('skip-b-upload', '1'))}&inflight=${encodeURIComponent(arg('inflight', '3'))}&yuv=${YUV ? '1' : '0'}${LAB ? `&lab=${encodeURIComponent(LAB)}` : ''}`);
  await page.waitForFunction(() => window.__mv && window.__mv.ready, null, { timeout: 60000 });
  const renderer = await page.evaluate(() => window.__mv.renderer);
  if (/swiftshader|llvmpipe|basic render/i.test(renderer)) console.warn('[export] WARNING: software WebGL - GPU not in use');

  if (SHEET || RAW) {
    await page.evaluate((ts) => window.__mv.exportTimes(ts), times);
    if (failed) throw failed;
  } else {
    console.log(`[export] ${W}x${H} @ ${FPS}fps  frames ${firstFrame}..${lastFrame - 1} (${total})  song time ${(firstFrame / FPS).toFixed(3)}..${(lastFrame / FPS).toFixed(3)} s  codec=${CODEC} input=${YUV ? 'yuv420p' : 'rgba'}`);
    console.log(`[export] renderer: ${renderer}`);
    const t0 = Date.now(), chunk = cfg.export.chunkFrames;   // (wall clock is used for the progress display only)
    for (let a = firstFrame; a < lastFrame; a += chunk) {
      const b = Math.min(lastFrame, a + chunk);
      const ms = await page.evaluate(([x, y, fps]) => window.__mv.exportRange(x, y, fps), [a, b, FPS]);
      if (failed) throw failed;
      const done = b - firstFrame, rate = done / ((Date.now() - t0) / 1000);
      process.stdout.write(`\r[export] ${done}/${total} frames  ${rate.toFixed(1)} fps  eta ${Math.ceil((total - done) / rate)}s  ` +
        `(ms/frame: render ${ms.render} read ${ms.read} send ${ms.send}; frame-loop ${ms.loopFps} fps)   `);
    }
    process.stdout.write('\n');
  }
} finally {
  if (ff) ff.stdin.end(); else rawOut.end();
  await browser.close();
  server.close();
}
await ffDone;
await rawDone;
console.log(`[export] wrote ${path.relative(ROOT, OUT)}  (${received} frames, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
