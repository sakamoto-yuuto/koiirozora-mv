// THE SKY AND THE WIRES (T07): the one smooth gradient of the film (恋色の空, 320.44 s and after), the telephone
// wires that carry the last look across the city, the lamps that pass as dot cones, and the breath in the cold.
//
// The gradient is the exception docs/VISUAL.md §1 allows: amber at the horizon (his role `you`), through the blended
// role `koi`, her wine (`me`), to indigo (`bg`) at the top. It is drawn only by the koi / outro / end sections; every
// other light in the film is still a dot screen. `koi` is grey in every palette but `koi`, so the mixture cannot
// appear before its time.
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog } from '../engine/util.js';

/**
 * The only smooth gradient: amber horizon -> koi -> wine -> indigo top. The palette is the state, so during the
 * outro the same call brightens by itself as the shot's palette blends koi -> dawn. `dawn` adds the pale light that
 * comes up at the horizon.
 */
export function koiSky(ctx, t, { dawn = 0, x = -420, y = -620, w = 2760, h = 2260 } = {}) {
  ctx.gradRect(x, y, w, h, [
    [0, 'bg', 1],
    [0.22, 'meDim', 1],
    [0.42, 'me', 1],
    [0.58, 'koi', 1],
    [0.74, 'you', 1],
    [0.86, 'youHot', 1],
    [1, 'youHot', 1],
  ], 'v');
  if (dawn > 0.001) {
    // the light coming up from below the roofs: a wide, low pool in paper colour, still a smooth field
    ctx.radial(960, 1140, 1000, 'text', 0.16 * dawn);
    ctx.radial(1360, 1080, 760, 'youHot', 0.18 * dawn);
    ctx.rect(x, y, w, h, { fill: true, color: 'text', alpha: 0.035 * dawn });
  }
}

/** One sagging span of telephone wire, swaying lightly in the wind. */
export function wire(ctx, t, { x0 = -80, y0 = 190, x1 = 2000, y1 = 250, sag = 86, color = 'panel', alpha = 1, width = 2.2, n = 44, phase = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, sway = Math.sin(t * 0.9 + phase + u * 4.2) * 2.4 * Math.sin(u * Math.PI);
    pts.push([lerp(x0, x1, u), lerp(y0, y1, u) + Math.sin(u * Math.PI) * sag + sway]);
  }
  ctx.poly(pts, { color, alpha, width });
}

/** A row of wires over the street (three spans of slightly different height and sag). */
export function wireRow(ctx, t, { y = 168, camX = 0, color = 'panel', alpha = 1, phase = 0 } = {}) {
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 34 - (camX * 0.08) % 180;
    wire(ctx, t, { x0: -160 + off, y0: y + i * 26, x1: 2100 + off, y1: y + i * 26 + 22, sag: 78 + i * 14, color, alpha: alpha * (0.85 - i * 0.15), width: 2.4 - i * 0.3, phase: phase + i * 1.7 });
  }
}

/**
 * A telephone run seen along the wire: poles at fixed world positions, three wires sagging between them, the near
 * wire in front. camX = camera truck in px (the poles slide left). Used for the outro's move across the city.
 */
export function telephoneRun(ctx, t, { camX = 0, y = 176, spacing = 720, color = 'panel', alpha = 1, poles = 7, poleH = 700, ground = 1040, fade = null } = {}) {
  const start = Math.floor((camX - 400) / spacing) - 1;
  const xs = [];
  for (let i = start; i < start + poles; i++) xs.push([i * spacing - camX, i]);
  for (const [x, i] of xs) {
    if (x < -260 || x > 2180) continue;
    const a = fade ? fade(x) : 1;
    ctx.rect(x - 6, y, 12, poleH, { fill: true, color, alpha: alpha * a });
    ctx.rect(x - 50, y + 46, 100, 10, { fill: true, color, alpha: alpha * a });
    for (let q = 0; q < 3; q++) ctx.rect(x - 42 + q * 36, y + 54 + q * 4, 12, 18, { fill: true, color, alpha: alpha * a * 0.9 });
    // a small transformer can and its shadow plate
    ctx.at(9, 11, () => ctx.rrect(x + 8, y + 150, 34, 62, 6, { fill: true, color: 'bg', alpha: alpha * a * 0.5 }));
    ctx.rrect(x + 8, y + 150, 34, 62, 6, { fill: true, color, alpha: alpha * a * 0.85 });
  }
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < xs.length - 1; j++) {
      const [xa, ia] = xs[j], [xb, ib] = xs[j + 1];
      if (xb < -100 || xa > 2020) continue;
      const y0 = y + 58 + k * 12, y1 = y + 58 + k * 12, sag = 62 + k * 18;
      wire(ctx, t, { x0: xa, y0, x1: xb, y1, sag, color, alpha: alpha * (0.95 - k * 0.18), width: 2.4 - k * 0.4, phase: ia * 0.8 + k });
    }
  }
}

/** A mercury lamp on its pole, with the cone of dots and the pool on the snow (docs/VISUAL.md §1.2). */
export function lampPost(ctx, t, { x, baseY = 960, h = 700, lit = 1, cell = 10, alpha = 1, color = 'ice' } = {}) {
  if (alpha <= 0.003) return;
  const headY = baseY - h;
  ctx.rect(x - 6, headY, 12, h, { fill: true, color: 'bg', alpha });
  ctx.rect(x - 6, headY, 72, 10, { fill: true, color: 'bg', alpha });
  ctx.rect(x + 36, headY + 8, 30, 9, { fill: true, color: 'text', alpha: alpha * (0.5 + 0.5 * lit) });
  if (lit > 0.01) {
    ctx.glow(color, 30, () => ctx.rect(x + 34, headY + 6, 36, 12, { fill: true, color, alpha: alpha * lit }), lit);
    ctx.poly([[x + 34, headY + 18], [x + 70, headY + 18], [x + 140, baseY + 80], [x - 40, baseY + 80]], { fill: true, color, alpha: 0.1 * lit, close: true });
    ctx.poly([[x + 46, headY + 18], [x + 60, headY + 18], [x + 100, baseY + 80], [x + 6, baseY + 80]], { fill: true, color, alpha: 0.16 * lit, close: true });
  }
}

/** A breath in the cold: a small forward cloud of dots that leans and thins as it goes (no smooth gradient). */
export function breathCloud(ctx, t, { x = 960, y = 600, k = 0, color = 'text', alpha = 0.8, dir = [-1, -0.35] } = {}) {
  if (k <= 0 || k >= 1) return;
  const g = ctx.g;
  g.fillStyle = ctx.col(color, alpha * (1 - k * 0.7));
  g.beginPath();
  for (let i = 0; i < 44; i++) {
    const u = (i / 44 + 0.03 * rand(711, i)) % 1;
    const travel = easeOut(clamp(k * 1.15)) * (90 + 130 * u);
    const px = x + dir[0] * travel * (0.55 + 0.45 * u) + (rand(713, i, 1) - 0.5) * (34 + 70 * u);
    const py = y + dir[1] * travel - u * 70 + (rand(717, i, 2) - 0.5) * (32 + 54 * u);
    const s = (2.2 + 9 * u) * (1 - 0.55 * k) * (0.7 + 0.6 * rand(719, i, 3));
    g.moveTo(px + s, py); g.arc(px, py, s, 0, 6.2832);
  }
  g.fill();
}
