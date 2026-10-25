// Baseline contact sheets for the stretches v4 keeps (docs/v4/PROMPT_v4.md §9, step 0): one frame per beat.
//   node tools/base_sheets.mjs base     -> out/base_<set>.png   (rendered ONCE, from the untouched v3 code)
//   node tools/base_sheets.mjs cmp      -> out/cmp_<set>.png    (after a change to a shared file)
//   .venv\Scripts\python tools/compare_sheets.py               (lists every tile that differs)
// (The base_* sheets were rendered from v3, whose walls were blurred illustrations: against them every tile differs
// in its wall. To compare a change of your own, render a set before it and one after it under two other prefixes and
// give both to compare_sheets.py: --a <before> --b <after>.)
// Sets: a1 / a2 = 0:00-0:59 (beats 0-63 / 64-127), e = 103.73-121.73 s, f = 125.65-148.04 s.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const grid = JSON.parse(fs.readFileSync(path.join(ROOT, cfg.paths.features), 'utf8')).grid;
const Bt = (b) => +(grid.t0 + b * grid.period).toFixed(4);
const range = (a, z) => Array.from({ length: z - a + 1 }, (_, i) => a + i);

export const TILE = { w: 640, h: 360, cols: 8, pad: 6 };
export const SETS = {
  a1: range(0, 63).map(Bt), a2: range(64, 127).map(Bt),
  e: range(224, 262).map(Bt),
  f: [271.5, ...range(272, 319)].map(Bt),
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prefix = process.argv[2] || 'cmp', only = process.argv.slice(3).filter((a) => !a.startsWith('--'));
  for (const [name, times] of Object.entries(SETS)) {
    if (only.length && !only.includes(name)) continue;
    const out = `out/${prefix}_${name}.png`;
    const r = spawnSync(process.execPath, ['export/export.mjs', '--sheet', out, '--times', times.join(','), '--cols', String(TILE.cols), '--width', String(TILE.w), '--height', String(TILE.h)], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  fs.writeFileSync(path.join(ROOT, 'out', 'base_sets.json'), JSON.stringify({ tile: TILE, sets: SETS }));
}
