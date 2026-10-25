// Bridge for an export started before progress.json existed: read out/exp_par.log (one line per chunk every 30 s)
// and write out/progress.json every 3 s, until the log says the film was written.
//   node tools/progress_from_log.mjs out/exp_par.log 0 395.4 30
import fs from 'node:fs';
const [log, start, end, fps] = process.argv.slice(2);
const F = Math.round((+end - +start) * +fps), started = fs.statSync(log).birthtimeMs || Date.now();
const tick = () => {
  const s = fs.readFileSync(log, 'utf8'), head = /in (\d+) chunks of ~(\d+)/.exec(s);
  if (!head) return;
  const n = +head[1], per = +head[2], rows = s.split('\n').filter((l) => /^\s+\d+ s \|/.test(l)), last = rows.at(-1) ?? '', prev = rows.at(-2) ?? '';
  const nums = (l) => (l.split('|')[1] ?? '').trim().split(/\s+/).map((x) => (x === '-' ? 0 : +x));
  // '-' means no progress line: either not started yet, or finished (its last line became "wrote ..."). It is finished
  // when that chunk had progress in an earlier row.
  const seen = Array(n).fill(0); for (const r of rows) nums(r).forEach((v, k) => { seen[k] = Math.max(seen[k], v); });
  const raw = (last.split('|')[1] ?? '').trim().split(/\s+/);
  const cur = nums(last).map((v, k) => (raw[k] === '-' && seen[k] > 0 ? Infinity : v)), was = nums(prev), dt = 30;
  const chunks = Array.from({ length: n }, (_, k) => {
    const total = Math.min(per, F - k * per);
    return { k, from: (k * per) / +fps, to: (k * per + total) / +fps, total, done: Math.min(total, cur[k] || 0), rate: cur[k] === Infinity ? 0 : Math.max(0, ((cur[k] || 0) - (was[k] || 0)) / dt), ok: cur[k] === Infinity };
  });
  const done = /\[parallel\] wrote/.test(s);
  fs.writeFileSync('out/progress.json', JSON.stringify({ phase: done ? 'done' : 'render', out: '(from log)', started, now: Date.now(), fps: +fps, start: +start, end: +end, chunks: done ? chunks.map((c) => ({ ...c, done: c.total, ok: true })) : chunks }));
  if (done) process.exit(0);
};
tick(); setInterval(tick, 3000);
