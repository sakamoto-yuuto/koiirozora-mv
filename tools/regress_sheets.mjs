// Before / after contact sheets of the sections that are already rebuilt (docs/v4/PROGRESS.md), for use around a
// change to a shared file: render once BEFORE the change, once after, and compare tile by tile.
//   node tools/regress_sheets.mjs r0            -> out/r0_<set>.png   (before)
//   node tools/regress_sheets.mjs r1            -> out/r1_<set>.png   (after)
//   .venv\Scripts\python tools/compare_sheets.py --a r0 --b r1 --sets out/regress_sets.json
// Sets: b = chorus 1 (59.42-74.19 s), g = the twelve shouts, the count, the last shout (148.04-162.81 s),
//       h1 / h2 = the last chorus and the four LOVE lines (162.81-192.34 s), i = the ending (192.34-211.5 s);
//       a half beat per tile (the ending: a beat). The stretches v4 keeps as they were are tools/base_sheets.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TILE } from './base_sheets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const grid = JSON.parse(fs.readFileSync(path.join(ROOT, cfg.paths.features), 'utf8')).grid;
const Bt = (b) => +(grid.t0 + b * grid.period).toFixed(4);
const halves = (a, z) => Array.from({ length: Math.round((z - a) * 2) }, (_, i) => Bt(a + i / 2));
const beats = (a, z) => Array.from({ length: z - a }, (_, i) => Bt(a + i));

export const SETS = { b: halves(128, 160), g: halves(320, 352), h1: halves(352, 384), h2: halves(384, 416), i: beats(416, 458) };

const prefix = process.argv[2] || 'r1', only = process.argv.slice(3).filter((a) => !a.startsWith('--'));
for (const [name, times] of Object.entries(SETS)) {
  if (only.length && !only.includes(name)) continue;
  const r = spawnSync(process.execPath, ['export/export.mjs', '--sheet', `out/${prefix}_${name}.png`, '--times', times.join(','), '--cols', String(TILE.cols), '--width', String(TILE.w), '--height', String(TILE.h)], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
fs.writeFileSync(path.join(ROOT, 'out', 'regress_sets.json'), JSON.stringify({ tile: TILE, sets: SETS }));
