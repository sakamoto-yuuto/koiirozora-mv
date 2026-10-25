// Background launcher for a full MV render. Run normally to detach; --worker is internal.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_DIR = path.join(ROOT, 'out', '_t09');
const LOG = path.join(RUN_DIR, 'full_render.log');
const META = path.join(RUN_DIR, 'render_meta.json');
const PID = path.join(RUN_DIR, 'render.pid');
const OUTPUT_REL = 'out/恋色空_v2_全片_720p.mp4';
const OUTPUT = path.join(ROOT, OUTPUT_REL);
const ARGS = ['tools/render_film.mjs', '--start', '0', '--end', '395.41', '--jobs', '3', '--out', OUTPUT_REL];

fs.mkdirSync(RUN_DIR, { recursive: true });

if (!process.argv.includes('--worker')) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker'], {
    cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true,
  });
  fs.writeFileSync(PID, String(child.pid));
  console.log(`[mv] detached render pid=${child.pid}`);
  console.log(`[mv] log=${path.relative(ROOT, LOG)}`);
  child.unref();
} else {
  const startedAt = new Date().toISOString();
  const command = `node ${ARGS.map((x) => /[\s]/.test(x) ? JSON.stringify(x) : x).join(' ')}`;
  const writeMeta = (extra = {}) => fs.writeFileSync(META, JSON.stringify({
    startedAt, finishedAt: null, exitCode: null, signal: null,
    output: OUTPUT, outputRel: OUTPUT_REL, log: LOG, command, ...extra,
  }, null, 2));
  writeMeta();

  const fd = fs.openSync(LOG, 'w');
  const child = spawn(process.execPath, ARGS, {
    cwd: ROOT,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  let settled = false;
  const finish = (code, signal) => {
    if (settled) return;
    settled = true;
    try { fs.closeSync(fd); } catch {}
    writeMeta({ finishedAt: new Date().toISOString(), exitCode: code, signal: signal ?? null });
    process.exitCode = code ?? 1;
  };
  child.on('error', (err) => {
    try { fs.appendFileSync(LOG, `\n[mv] failed to start renderer: ${err.stack || err}\n`); } catch {}
    finish(1, null);
  });
  child.on('exit', finish);
}
