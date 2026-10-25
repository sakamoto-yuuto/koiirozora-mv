// Detach the dashboard server (Start-Process can fail in this environment due to duplicate proxy env vars).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = path.join(ROOT, 'out', '_t09');
fs.mkdirSync(RUN, { recursive: true });
const out = fs.openSync(path.join(RUN, 'dashboard_server.log'), 'w');
const err = fs.openSync(path.join(RUN, 'dashboard_server.err.log'), 'w');
const p = spawn(process.execPath, ['tools/mv_dashboard.mjs', '--port', '8765'], {
  cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', out, err],
});
fs.writeFileSync(path.join(RUN, 'dashboard.pid'), String(p.pid));
console.log(`[dashboard] detached pid=${p.pid}`);
p.unref();
