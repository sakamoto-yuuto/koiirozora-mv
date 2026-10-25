// The film's recurring props, each ONE generated element used in every shot of it (user review 2026-10-23: never two
// different drawings of one prop). Positions are measured on the pictures (u, v in 0..1 of the picture).
import { segDigits } from '../components/phone.js';
import { snow, fog } from '../components/world.js';
import { dotCone } from '../components/print.js';
import { backdrop } from './stage.js';
import { cues } from './cues.js';
import { clamp } from '../engine/util.js';

// ---- the public phone: obj_phone_panel, flat-on front -------------------------------------------------------------
export const PANEL = {
  ar: 941 / 1672,
  led: { u0: 0.414, u1: 0.706, v0: 0.205, v1: 0.264 },                 // the dark LED window
  slot: { u0: 0.734, u1: 0.871, v: 0.236 },                            // the card slit (its lower lip)
  key: (c, r) => [[0.455, 0.562, 0.670][c], [0.319, 0.378, 0.437, 0.497][r]], keyW: 0.0744,
  hook: { u0: 0.123, u1: 0.372, v0: 0.187, v1: 0.632 },
};
export const KEYPOS = { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [0, 1], 5: [1, 1], 6: [2, 1], 7: [0, 2], 8: [1, 2], 9: [2, 2], '*': [0, 3], 0: [1, 3], '#': [2, 3] };

/** The phone drawn with its point (u, v) at screen (x, y), ph px tall: { d: dst rect, at(u, v) -> [x, y] }. */
export function panelAt(u, v, x, y, ph) {
  const pw = ph * PANEL.ar, d = { x: x - u * pw, y: y - v * ph, w: pw, h: ph };
  return { d, at: (uu, vv) => [d.x + uu * pw, d.y + vv * ph] };
}

/** The units left, in the phone's own LED window (P from panelAt). */
export function ledDigits(ctx, P, n) {
  const [x0, y0] = P.at(PANEL.led.u0, PANEL.led.v0), [x1, y1] = P.at(PANEL.led.u1, PANEL.led.v1), h = 0.62 * (y1 - y0);
  segDigits(ctx, String(n), x1 - 0.12 * (y1 - y0) - 1.88 * h, (y0 + y1) / 2 - h / 2, h, { n: 3, color: 'err' });
}

/**
 * The units on her card (docs/STORYBOARD_v2.md v2.1: ONE rate). 50 from the card (20.21); from ピー (74.61, bar 23) one
 * unit on every downbeat - 19 left when the tape cuts her off (173.81, bar 54). The second call takes one unit on
 * connecting and then one per bar; it reaches 0 inside L21 (264.16 - 270.00), where the card comes out.
 */
export function units(env, t) {
  const { B } = cues(env);
  if (t < B(23)) return 50;
  if (t < B(54)) return 50 - Math.floor((t - B(23)) / (B(24) - B(23)) + 1e-6);
  if (t < B(66) + 0.15) return 19;                                     // cut off, card still in; redialled
  return Math.max(0, 18 - Math.floor((t - B(66)) / (B(24) - B(23)) + 1e-6));   // the second call: 18 on connecting, 0 on BAR 84 (269.81, inside L21)
}
export const unitsLeft = (env, t) => clamp(units(env, t) ?? 0, 0, 50);

// ---- the booth from inside, looking past her: the street out of focus through the glass, the tube light, fog, snow --
export function boothInside(ctx, env, t, { focus = [0.32, 0.5], fogK = 0.5 } = {}) {
  backdrop(ctx, env, 'bg_street_night', { focus, zoom: 1.7, blur: 9 });
  ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg', alpha: 0.35 });                  // the glass between us and the street
  snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 70, seed: 17, size: 3, alpha: 0.35, speed: 36 });
  dotCone(ctx, [980, -40], [980, 1080], 820, 'ice', { alpha: 0.55, cell: 12, w0: 380 });
  fog(ctx, { x: -60, y: 640, w: 2040, h: 460 }, { k: fogK, cell: 7, seed: 31 });
}
