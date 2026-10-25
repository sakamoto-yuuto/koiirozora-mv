// Walking feet in close-up, with footprints that ARE their shoes (user review: in a close-up the prints must match the
// shoe that made them; far shots may stay rough). Measured on the walk drawings (tools: the bottom band of each frame's
// matte): which foot is planted in each drawing and where (x0..x1 = the sole, source px), and the ground line.
// The figure moves over the ground so that the planted foot never slides; every step leaves a print of that sole's
// length where the foot was. The camera pans at the average speed, so the ground and the prints scroll smoothly while
// the held drawings advance in steps (limited animation).
import { cues } from './cues.js';
import { fig } from './stage.js';

// planted sole per drawing [x0, x1] (source px), the ground line, and which drawings put a NEW foot down (a print)
export const WALKS = {
  her: { base: 'y_walk', dir: 1, W: 503, H: 739, ground: 720, planted: [[371, 490], [243, 355], [219, 330], [89, 177]], plants: [0], cm: 23 },
  him: { base: 'yt_walk_side', dir: -1, W: 810, H: 1804, ground: 1778, planted: [[26, 253], [178, 403], [572, 785], [162, 381]], plants: [0, 2], cm: 27,
    // his cycle has two steps: drawings 0-1 stand on foot A, 2-3 on foot B; the sole that comes down in drawing 2 is [24, 251]
    plantSole: { 0: [26, 253], 2: [24, 251] } },
};

/** How far the body has moved (source px, along dir) after drawing d (d = 0, 1, 2 ...): the planted foot stays put. */
function bodyX(w, d) {
  const step = (i) => {                                                // movement from drawing i to i + 1 (i mod 4)
    const k = i % 4, a = w.planted[k], b = w.planted[(k + 1) % 4];
    if (w.base === 'y_walk' && k === 3) return 365 - 371;            // her: the other foot, drawn the same as drawing 0
    if (w.base === 'yt_walk_side' && k === 1) return 178 - 572;
    if (w.base === 'yt_walk_side' && k === 3) return 162 - 516;
    if (w.base === 'yt_walk_side' && k === 2) return 24 - 162;
    return a[0] - b[0];
  };
  let x = 0;
  for (let i = 0; i < d; i++) x += Math.abs(step(i));
  return x;
}
const cycleLength = (w) => bodyX(w, 4);

/**
 * A footprint seen from a low side camera: the sole pressed into the snow, length L px, toe towards dir (+1 right), at
 * ground point (x = heel-to-toe centre, y). A darker hollow, the wall of snow lit along its far edge.
 */
export function sidePrint(ctx, x, y, L, dir, alpha = 0.85) {
  const n = 18, top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, wdt = 0.62 + 0.38 * Math.sin(Math.min(1, u * 1.25) * Math.PI) - (u < 0.5 ? 0.12 * Math.sin(u * 2 * Math.PI) : 0);   // heel - waist - ball - toe
    const px = x + dir * (u - 0.5) * L, h = 0.075 * L * wdt;
    top.push([px, y - h]); bot.push([px, y + h * 0.8]);
  }
  ctx.poly([...top, ...bot.reverse()], { fill: true, color: 'line', alpha, close: true });
  ctx.poly(top, { color: 'text', width: 2.5, alpha: alpha * 0.9 });                              // the lit far wall of the dent
  ctx.poly(top.map(([px, py]) => [px, py + 0.04 * L]), { color: 'panel', width: 2, alpha: alpha * 0.5 });   // its shadow inside
}

/**
 * The walking feet (crop of the lower legs) of `who`, h px for the cropped part, the ground at screen y = groundY; the
 * camera pans with them. Prints of the steps already taken are left behind. t0 = when the walk (drawing 0) starts.
 * Returns the screen x of the body origin (for anything else that should stay on the ground: other prints).
 */
export function walkingFeet(ctx, env, t, t0, who, { x = 960, groundY = 1000, h = 560, roles = null, seed = 240, alpha = 1, prevSteps = 6 } = {}) {
  const { P } = cues(env), w = WALKS[who], dt = P / 4, tau = t - t0, d = Math.max(0, Math.floor(tau / dt));
  const crop = { x: 0, y: w.H * 0.55, w: w.W, h: w.H * 0.45 }, s = h / crop.h;
  const vAvg = cycleLength(w) / (4 * dt);                              // source px per second
  const pan = (u) => x + w.dir * s * (u - vAvg * tau);                 // screen x of world (source) coordinate u
  const gy = groundY;
  // prints: every planting drawing before (and including) the current one, back to prevSteps steps before the shot
  const cyc = cycleLength(w), plants = w.plants;
  for (let c = -prevSteps; c <= Math.floor(d / 4); c++) {
    for (const pk of plants) {
      const dd = c * 4 + pk;
      if (dd > d) continue;
      const sole = (w.plantSole ?? {})[pk] ?? w.planted[pk];
      const wx = (c < 0 ? c * cyc + bodyX(w, pk) : bodyX(w, dd)) + (w.dir > 0 ? (sole[0] + sole[1]) / 2 : w.W - (sole[0] + sole[1]) / 2);
      const L = (sole[1] - sole[0]) * s * 1.08;                        // the print is the sole that made it
      if (!footprint(ctx, env, 'low', who, dd % 2 ? 'R' : 'L', pan(wx), gy + 0.02 * L, L, { flip: w.dir < 0 })) sidePrint(ctx, pan(wx), gy + (dd % 2 ? 7 : -5), L, w.dir, 0.85);
    }
  }
  // the figure: the drawing of this moment at its body position (the walk drawings face right for her, left for him;
  // in source px the body origin is the picture's left edge for her, its right edge for him)
  const bx = pan(bodyX(w, d)), name = `${w.base}_${d % 4}`;
  const left = w.dir > 0 ? bx : bx - w.W * s;
  fig(ctx, env, name, { x: left, y: gy - (w.ground - crop.y) * s, w: crop.w * s, h }, t, { crop, seed, breathe: 0, shadow: false, roles, alpha });
  return bx;
}

// ---- generated footprint sprites (art_src/v2/fx_footprints: one art layer - no code-drawn prints) --------------------
// fx_fp_<view>_<who>_<side>: view top (from above, toe up) | mid (45 deg, toe right) | low (ankle height, toe right)
const fpName = (view, who, side) => `fx_fp_${view}_${who}_${side}`;
/** One generated print: centre (x, y), length L px along its toe direction, angle a (rad; for 'top' 0 = toe up), mirrored if flip. */
export function footprint(ctx, env, view, who, side, x, y, L, { a = 0, flip = false, alpha = 1 } = {}) {
  const name = fpName(view, who, side);
  if (!env.plates?.has(name)) return false;
  const sz = env.plates.size(name), long = view === 'top' ? sz.h : sz.w, k = L / long, w = sz.w * k, h = sz.h * k;
  ctx.at(x, y, () => fig(ctx, env, name, { x: -w / 2, y: -h / 2, w, h }, 0, { flip, alpha, breathe: 0, shadow: false }), { rot: a });
  return true;
}
/** A line of top-down prints from p0 to p1 (screen px): stride = px between steps, L = print length, k = 0..1 drawn. */
export function topTrack(ctx, env, who, p0, p1, stride, L, k = 1, alpha = 1) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], D = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + Math.PI / 2, n = Math.floor((D / stride) * k);
  const nx = -dy / D, ny = dx / D;
  for (let i = 0; i <= n; i++) {
    const side = i % 2 ? 'R' : 'L', off = (side === 'R' ? 1 : -1) * L * 0.22;
    footprint(ctx, env, 'top', who, side, p0[0] + (dx * i * stride) / D + nx * off, p0[1] + (dy * i * stride) / D + ny * off, L, { a, alpha });
  }
}
/** A line of 45-degree prints across a ground plane from p0 to p1 (toe towards p1; mirrored when going left), with
 * perspective: sizes scale by s0 -> s1 along the line. */
export function midTrack(ctx, env, who, p0, p1, stride, L0, L1, alpha = 1) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], D = Math.hypot(dx, dy), n = Math.floor(D / stride), flip = dx < 0;
  for (let i = 0; i <= n; i++) {
    const u = (i * stride) / D, side = i % 2 ? 'R' : 'L', L = L0 + (L1 - L0) * u;
    footprint(ctx, env, 'mid', who, side, p0[0] + dx * u, p0[1] + dy * u + (side === 'R' ? 0.12 : -0.12) * L, L, { flip, alpha });
  }
}
