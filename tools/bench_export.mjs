// Reproducible T09 export benchmark.  Runs groups serially so separate rows do
// not contend with each other; each group delegates its requested worker count
// to export_parallel.mjs and is repeated twice.
//
//   node tools/bench_export.mjs
//   node tools/bench_export.mjs --quick       # one repeat, useful as a smoke test
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (key, fallback) => { const i = argv.indexOf(`--${key}`); return i < 0 ? fallback : argv[i + 1]; };
const repeats = argv.includes('--quick') ? 1 : +arg('repeats', 2);
const outDir = path.join(ROOT, 'out', '_t09');
fs.mkdirSync(outDir, { recursive: true });

const ranges = [{ id: '240-244', start: 240, end: 244 }, { id: '320-326', start: 320, end: 326 }];
const paths = [
  { id: 'old-x264', codec: 'libx264', pipeline: '0', pbo: '0', skipB: '0' },
  { id: 'old-nvenc', codec: 'h264_nvenc', pipeline: '0', pbo: '0', skipB: '0' },
  { id: 'new-nvenc', codec: 'h264_nvenc', pipeline: '1', pbo: '0', skipB: '1' },
];
const jobs = [1, 2, 4];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', (d) => { text += d; });
    child.stderr.on('data', (d) => { text += d; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve(text) : reject(new Error(`exit ${code}\n${text}`)));
  });
}

const results = [];
for (const range of ranges) for (const variant of paths) for (const job of jobs) {
  const runs = [];
  for (let n = 1; n <= repeats; n++) {
    const output = path.join('out', '_t09', `bench_${range.id}_${variant.id}_${job}j_r${n}.mp4`);
    const args = ['tools/export_parallel.mjs', '--start', String(range.start), '--end', String(range.end), '--width', '1280', '--height', '720', '--fps', '30',
      '--jobs', String(job), '--codec', variant.codec, '--pipeline', variant.pipeline, '--pbo', variant.pbo, '--skip-b-upload', variant.skipB, '--inflight', '3',
      ...(arg('ffmpeg', null) ? ['--ffmpeg', arg('ffmpeg', null)] : []), '--out', output];
    const started = performance.now();
    const log = await run(process.execPath, args);
    const seconds = (performance.now() - started) / 1000;
    const frames = Math.round((range.end - range.start) * 30);
    const loops = [...log.matchAll(/frame-loop ([\d.]+) fps/g)].map((m) => +m[1]);
    // Sum of independently-rendered worker frame rates is the group frame-loop
    // throughput.  It deliberately excludes browser/FFmpeg start-up.
    runs.push({ seconds, endToEndFps: frames / seconds, loopFps: loops.reduce((a, b) => a + b, 0), workerLoopFps: loops, output });
  }
  const avg = (key) => runs.reduce((sum, row) => sum + row[key], 0) / runs.length;
  results.push({ range: range.id, path: variant.id, jobs: job, repeats: runs.length, endToEndFps: avg('endToEndFps'), loopFps: avg('loopFps'), runs });
  const r = results.at(-1);
  console.log(`[bench] ${r.range} ${r.path} jobs=${job}: e2e ${r.endToEndFps.toFixed(2)} fps; loop ${r.loopFps.toFixed(2)} fps`);
}

const resultFile = path.join(outDir, 'bench_results.json');
fs.writeFileSync(resultFile, JSON.stringify({ generatedAt: new Date().toISOString(), repeats, ranges, results }, null, 2));
console.log(`[bench] wrote ${path.relative(ROOT, resultFile)}`);
