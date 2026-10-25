// Local realtime dashboard for tools/render_film.mjs.
//   node tools/mv_dashboard.mjs [--port 8765]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_DIR = path.join(ROOT, 'out', '_t09');
const LOG = path.join(RUN_DIR, 'full_render.log');
const META = path.join(RUN_DIR, 'render_meta.json');
const PID = path.join(RUN_DIR, 'render.pid');
const SEG_DIR = path.join(ROOT, 'out', '_segments', '1280x720_30');
const OUTPUT = path.join(ROOT, 'out', '恋色空_v2_全片_720p.mp4');
const HTML = path.join(ROOT, 'tools', 'mv_dashboard.html');
const portArg = process.argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(process.argv[portArg + 1]) : 8765;

const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const stat = (p) => { try { return fs.statSync(p); } catch { return null; } };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cleanLog = (s) => s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r/g, '\n');

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function getStatus() {
  const rawLog = readText(LOG);
  const log = cleanLog(rawLog);
  const meta = readJson(META);
  const pid = Number(readText(PID).trim()) || null;
  const processAlive = alive(pid);
  const startedMs = meta?.startedAt ? Date.parse(meta.startedAt) : (stat(LOG)?.birthtimeMs || Date.now());
  const outputStat = stat(OUTPUT);
  const tempVideoStat = stat(path.join(SEG_DIR, '_video.mp4'));

  const plan = [];
  for (const m of log.matchAll(/^\s*(RENDER|reuse)\s+([\d.]+)\s*-\s*([\d.]+)\s+(\S+)/gm)) {
    plan.push({ kind: m[1] === 'reuse' ? 'reuse' : 'render', from: +m[2], to: +m[3], section: m[4] });
  }
  const doneKeys = new Set();
  const doneFinishTimes = [];
  for (const m of log.matchAll(/^\s*done\s+([\d.]+)\s*-\s*([\d.]+)\s+\((\d+)\s*s\)/gm)) {
    doneKeys.add(`${(+m[1]).toFixed(2)}-${(+m[2]).toFixed(2)}`);
    doneFinishTimes.push(+m[3]);
  }

  const active = [];
  try {
    for (const ent of fs.readdirSync(SEG_DIR, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith('.part.mp4')) continue;
      const m = /^(\d+)-(\d+)\.mp4\.part\.mp4$/.exec(ent.name);
      if (!m) continue;
      const s = stat(path.join(SEG_DIR, ent.name));
      if (!s || s.mtimeMs < startedMs - 2000) continue;
      const from = +m[1] / 30, to = +m[2] / 30;
      const p = plan.find((x) => Math.abs(x.from - from) < 0.02 && Math.abs(x.to - to) < 0.02);
      active.push({
        name: ent.name, from, to, section: p?.section ?? '', bytes: s.size,
        mtime: new Date(s.mtimeMs).toISOString(), ageSeconds: Math.max(0, (Date.now() - s.mtimeMs) / 1000),
      });
    }
  } catch {}

  const activeKey = new Set(active.map((a) => `${a.from.toFixed(2)}-${a.to.toFixed(2)}`));
  for (const p of plan) {
    const key = `${p.from.toFixed(2)}-${p.to.toFixed(2)}`;
    if (p.kind === 'reuse') p.status = 'reused';
    else if (doneKeys.has(key)) p.status = 'done';
    else if (activeKey.has(key)) p.status = 'rendering';
    else p.status = 'pending';
  }

  const expectedPieces = plan.length || 30;
  const renderPieces = plan.filter((p) => p.kind === 'render').length;
  const reusedPieces = plan.filter((p) => p.kind === 'reuse').length;
  const renderedDone = plan.filter((p) => p.kind === 'render' && p.status === 'done').length;
  const completePieces = reusedPieces + renderedDone;
  const percent = expectedPieces ? (100 * completePieces) / expectedPieces : 0;
  const renderFilmSeconds = plan.filter((p) => p.kind === 'render').reduce((s, p) => s + p.to - p.from, 0);
  const doneFilmSeconds = plan.filter((p) => p.kind === 'render' && p.status === 'done').reduce((s, p) => s + p.to - p.from, 0);
  const remainingFilmSeconds = Math.max(0, renderFilmSeconds - doneFilmSeconds);

  const completedLog = /\[film\] wrote\s+/.test(log);
  const failedLog = /\[film\] a piece failed|\[mv\] failed to start/.test(log);
  const allRenderDone = renderPieces === 0 || renderedDone >= renderPieces;
  let phase = 'starting';
  if (completedLog) phase = 'complete';
  else if (failedLog || (meta?.exitCode != null && meta.exitCode !== 0)) phase = 'failed';
  else if (!rawLog.trim()) phase = processAlive ? 'starting' : 'idle';
  else if (allRenderDone && processAlive) phase = 'muxing';
  else if (processAlive) phase = 'rendering';
  else phase = 'interrupted';

  const endMs = meta?.finishedAt ? Date.parse(meta.finishedAt) : (outputStat?.mtimeMs && completedLog ? outputStat.mtimeMs : Date.now());
  const elapsedSeconds = Math.max(0, (endMs - startedMs) / 1000);
  const observedRate = elapsedSeconds > 1 && doneFilmSeconds > 0 ? doneFilmSeconds / elapsedSeconds : 0;
  const assumedRate = observedRate > 0.03 ? observedRate : 0.16;
  let etaSeconds = null;
  if (phase === 'rendering') etaSeconds = remainingFilmSeconds / assumedRate + 8;
  else if (phase === 'muxing') etaSeconds = tempVideoStat ? Math.max(5, 20 - (Date.now() - tempVideoStat.mtimeMs) / 1000) : 12;
  else if (phase === 'complete') etaSeconds = 0;

  const lines = log.trimEnd().split('\n');
  const logTail = lines.slice(-100);
  const lastLogMtime = stat(LOG)?.mtimeMs ?? null;
  const logIdleSeconds = lastLogMtime ? (Date.now() - lastLogMtime) / 1000 : null;
  const stalled = phase === 'rendering' && active.length > 0 && active.every((a) => a.ageSeconds > 150);

  return {
    now: new Date().toISOString(),
    startedAt: new Date(startedMs).toISOString(),
    finishedAt: meta?.finishedAt ?? null,
    processAlive, pid, phase, stalled,
    expectedPieces, renderPieces, reusedPieces, renderedDone, completePieces,
    percent: Number(percent.toFixed(2)),
    renderFilmSeconds: +renderFilmSeconds.toFixed(2),
    doneFilmSeconds: +doneFilmSeconds.toFixed(2),
    remainingFilmSeconds: +remainingFilmSeconds.toFixed(2),
    elapsedSeconds: Math.round(elapsedSeconds),
    etaSeconds: etaSeconds == null ? null : Math.round(etaSeconds),
    output: { path: OUTPUT, exists: !!outputStat, bytes: outputStat?.size ?? 0, modified: outputStat ? new Date(outputStat.mtimeMs).toISOString() : null },
    outputRel: meta?.outputRel ?? 'out/恋色空_v2_全片_720p.mp4',
    active,
    plan,
    logTail,
    logIdleSeconds: logIdleSeconds == null ? null : Math.round(logIdleSeconds),
    meta,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (url.pathname === '/api/status') {
    const body = JSON.stringify(getStatus());
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    res.end(body);
    return;
  }
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok\n'); return; }
  if (url.pathname === '/output') {
    const s = stat(OUTPUT);
    if (!s) { res.writeHead(404); res.end('not ready\n'); return; }
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': s.size, 'content-disposition': 'inline; filename="koiirozora_mv_720p.mp4"' });
    fs.createReadStream(OUTPUT).pipe(res);
    return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(HTML).pipe(res);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found\n');
});
server.listen(PORT, '127.0.0.1', () => console.log(`[dashboard] http://127.0.0.1:${PORT}`));

