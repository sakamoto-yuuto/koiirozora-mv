// Print the time grid of a stretch of the song: bars, beats, and every sung character, in song seconds.
// The first step of building any section (docs/PROCESS.md §2):  node tools/beatmap.mjs <from> <to>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Features } from '../src/engine/features.js';
import { Lyrics } from '../src/engine/lyrics.js';
import { charTimes } from '../src/scenes/kit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const features = new Features(JSON.parse(fs.readFileSync(path.join(ROOT, cfg.paths.features), 'utf8')), cfg);
const lyrics = new Lyrics(JSON.parse(fs.readFileSync(path.join(ROOT, cfg.paths.lyrics), 'utf8')), cfg, features);
const env = { cfg, features, lyrics };
const [from, to] = process.argv.slice(2).map(Number);
const P = features.period, t0 = features.t0, ph = features.downPhase;
const rows = [];
for (let b = Math.ceil((from - t0) / P); t0 + b * P <= to; b++) {
  const t = t0 + b * P, bar = (b - ph) / 4;
  rows.push([t, Number.isInteger(bar) ? `BAR ${bar}` : `  beat ${b}`]);
}
lyrics.lines.forEach((l, i) => charTimes(env, i).forEach((c, j) => { if (c.t >= from && c.t <= to) rows.push([c.t, `      ${j === 0 ? `L${i} ` : '    '}${c.c}`]); }));
rows.sort((a, b) => a[0] - b[0]).forEach(([t, s]) => console.log(`${t.toFixed(2).padStart(7)}  ${s}`));
