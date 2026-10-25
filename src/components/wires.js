// THE LINE, part 3: the telephone network over the city, and one window far away.
// Drawn in the print language (components/print.js): flat inks, halftone light, snow, hairline structure.
//
//   wirePts()       the points of one sagging wire from a to b (sag in px, downward)
//   drawWire()      that wire
//   pulseAlong()    a pulse of light (her call) travelling along such a wire, with a short trail
//   pole()          one telephone pole: a vertical, two crossarms, insulators, snow on top
//   aerialCity()    the city from above at night: rows of snow-covered roofs receding, poles + wires, a sign
//   windowBlock()   one distant apartment block with a grid of windows and one window that can light
// Everything is a pure function of its arguments.
import { rand } from '../engine/prng.js';
import { clamp, easeOut, lerp } from '../engine/util.js';
import { dotFill, dotLight } from './print.js';
import { snow } from './world.js';

const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
const ROWS = 6;

/** Hairline width in virtual px, divided by the current transform's scale (see world.js). */
function lw(ctx, px = 1.4) {
  const m = ctx.g.getTransform();
  const s = (Math.hypot(m.a, m.b) / (ctx.scale || 1)) || 1;
  return Math.max(0.3, px / s);
}

/** The points of a wire from a to b, drooping by `sag` px in the middle. */
export function wirePts(a, b, sag = 60, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * sag]);
  }
  return pts;
}

/** One wire. */
export function drawWire(ctx, pts, { color = 'ice', alpha = 0.6, width = 2, dash = null } = {}) {
  if (alpha <= 0.003) return;
  if (dash) {
    const g = ctx.g;
    g.save(); g.setLineDash(dash);
    ctx.poly(pts, { color, alpha, width });
    g.restore();
  } else ctx.poly(pts, { color, alpha, width });
}

/** The point at u (0..1, by point count) of a dense polyline. */
function at(pts, u) {
  const x = clamp(u) * (pts.length - 1), i = Math.floor(x), k = x - i;
  const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}

/** A pulse of light travelling along a wire: a hot head, a short trail, a halo. */
export function pulseAlong(ctx, pts, u, { color = 'me', core = 'meHot', alpha = 1, r = 8, trail = 5 } = {}) {
  if (u < 0 || u > 1 || alpha <= 0.003) return;
  for (let q = trail; q >= 0; q--) {
    const uu = u - q * 0.016;
    if (uu < 0) continue;
    const [x, y] = at(pts, uu), a = alpha * (q === 0 ? 1 : 0.34 * (1 - q / (trail + 1))), rr = r * (q === 0 ? 1 : 0.8 - 0.09 * q);
    if (q === 0) {
      ctx.glow(core, 26, () => ctx.circle(x, y, rr, { fill: true, color: core, alpha: a }), a);
      ctx.circle(x, y, rr * 2.1, { color: color, width: 2, alpha: a * 0.5 });
    } else ctx.circle(x, y, rr, { fill: true, color: color, alpha: a });
  }
}

/** A telephone pole standing at (x, baseY), height h in screen px. */
export function pole(ctx, x, baseY, h, { color = 'bg', alpha = 1, sc = 1, arms = 2, snowCap = true, wires = true } = {}) {
  const w = Math.max(2.5, 8 * sc);
  ctx.rect(x - w / 2, baseY - h, w, h, { fill: true, color, alpha });
  ctx.line(x - w / 2, baseY - h, x - w / 2, baseY, { color: 'ice', alpha: alpha * 0.24, width: lw(ctx, 1.3) });
  ctx.line(x + w / 2, baseY - h + 2, x + w / 2, baseY, { color: 'text', alpha: alpha * 0.14, width: lw(ctx, 1.1) });
  for (let a = 0; a < arms; a++) {
    const y = baseY - h + (16 + a * 30) * sc, aw = (76 - a * 12) * sc;
    ctx.rect(x - aw / 2, y, aw, Math.max(2, 6 * sc), { fill: true, color, alpha });
    for (const dx of [-aw / 2 + 7 * sc, 0, aw / 2 - 7 * sc]) {
      ctx.circle(x + dx, y - 2 * sc, Math.max(1.6, 3 * sc), { fill: true, color: 'ice', alpha: alpha * 0.5 });
    }
  }
  if (snowCap) ctx.rrect(x - w, baseY - h - 4 * sc, 2 * w, Math.max(2, 4 * sc), 2, { fill: 'text', alpha: alpha * 0.7 });
  return wires ? baseY - h + 16 * sc : baseY - h;
}

/**
 * The city at night, from above.
 *   rise 0..1   the camera has risen: rows slide down and shrink a little
 *   camX        the camera truck (px), only a slow drift
 *   sign        a rooftop lightbox: { row, x, w, h, chars: [{ c, t }], at?, label? }
 * Returns { rows, trunks, sign } — rows for reference, trunks are polylines for the pulses.
 */
export function aerialCity(ctx, t, { rise = 0, camX = 0, seed = 11, sign = null, haze = 0 } = {}) {
  const horizon = 248 - 46 * rise;
  const vx = 960 - camX * 0.12;
  // ---- sky: snow cloud glow over the city -----------------------------------------------------
  ctx.rect(-80, -80, 2080, horizon + 90, { fill: true, color: 'panel' });
  dotLight(ctx, vx, horizon + 26, 1480, 'ice', { sy: 0.3, alpha: 0.3, cell: 15, power: 1.4 });
  dotLight(ctx, vx + 360, horizon + 6, 820, 'raised', { sy: 0.22, alpha: 0.85, cell: 12 });
  dotFill(ctx, { x: 0, y: 0, w: 1920, h: horizon + 50 }, 'bg', {
    density: 0.24, cell: 13, alpha: 0.6, vary: (px, py) => 0.2 + 0.8 * clamp(py / Math.max(1, horizon)),
  });
  // a low band of snow cloud, cut by the roofs
  for (let i = 0; i < 4; i++) {
    const y = 74 + i * 34 + Math.sin(t * 0.23 + i) * 5;
    ctx.line(80, y, 1840, y + 8, { color: 'line', width: 1.6, alpha: 0.12 });
    ctx.line(220, y + 9, 1620, y + 15, { color: 'line', width: 1.2, alpha: 0.08 });
  }
  // ---- the ground plane and its streets --------------------------------------------------------
  ctx.rect(-60, horizon, 2040, 1200 - horizon, { fill: true, color: 'bg' });
  dotFill(ctx, { x: 0, y: horizon, w: 1920, h: 1080 - horizon }, 'panel', {
    density: 0.34, cell: 11, alpha: 0.62, vary: (px, py) => 0.25 + 0.75 * clamp((py - horizon) / (1080 - horizon)),
  });
  for (let i = -12; i <= 12; i++) {
    const bx = vx + i * 240;
    ctx.line(vx, horizon, bx - camX * 1.1, 1140, { color: 'line', width: 1.8, alpha: 0.13 });
  }
  for (let j = 0; j < 9; j++) {
    const u = Math.pow((j + 0.55) / 9, 1.45);
    const y = horizon + (1120 - horizon) * u + 40 * rise * u;
    ctx.line(-40, y, 1960, y, { color: 'line', width: 1.5, alpha: 0.1 });
  }

  // ---- the rows of roofs -----------------------------------------------------------------------
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const uu = (r + 1) / ROWS;
    const y = horizon + (1090 - horizon) * Math.pow(uu, 1.5) + 80 * rise * uu;
    const sc = 0.30 + 1.0 * Math.pow(uu, 1.32);
    const par = -camX * (0.15 + 0.6 * uu);
    const spacing = 120 + 150 * sc;
    rows.push({ y, sc, par });

    // roofs and their facades, left to right; nearer rows are painted over farther ones
    for (let i = -2; i < 18; i++) {
      const jitter = (rand(seed, r, i, 1) - 0.5) * 46 * sc;
      const cx = i * spacing + par + jitter;
      if (cx < -260 || cx > 2180) continue;
      const bw = spacing * (0.74 + 0.32 * rand(seed, r, i, 2));
      if (bw < 8) continue;
      const fh = (30 + 26 * rand(seed, r, i, 3)) * sc;                 // facade height
      const rh = (56 + 52 * rand(seed, r, i, 4)) * sc;                 // roof depth (to the ridge)
      const yF = y - fh, yB = yF - rh, hf = bw * 0.5, hb = bw * (0.3 + 0.08 * rand(seed, r, i, 5));
      // facade (dark wall) with lit windows
      ctx.rect(cx - hf, yF, bw, fh + 4 * sc, { fill: true, color: 'raised' });
      ctx.line(cx - hf, yF, cx + hf, yF, { color: 'text', alpha: 0.16, width: lw(ctx, 1.2) });
      const cols = 2 + Math.floor(rand(seed, r, i, 6) * 3);
      for (let c = 0; c < cols; c++) {
        const cw = bw / cols, wx = cx - hf + c * cw + cw * 0.24, ww = cw * 0.5;
        const lit = rand(seed, r, i, 20 + c) > 0.3;
        ctx.rect(wx, yF + fh * 0.24, ww, fh * 0.36, { fill: true, color: lit ? 'you' : 'panel', alpha: lit ? 0.3 + 0.38 * rand(seed, r, i, 40 + c) : 0.9 });
        if (lit) ctx.line(wx, yF + fh * 0.24 + fh * 0.18, wx + ww, yF + fh * 0.24 + fh * 0.18, { color: 'bg', width: 1, alpha: 0.5 });
      }
      // the roof plane: a trapezoid; snow along the ridge, a hairline at the eave
      ctx.poly([[cx - hb, yB], [cx + hb, yB], [cx + hf, yF], [cx - hf, yF]], { fill: true, color: 'raised', close: true });
      ctx.poly([[cx - hb, yB], [cx + hb, yB], [cx + hf, yF], [cx - hf, yF]], {
        fill: true, color: 'text', alpha: 0.16 + 0.14 * rand(seed, r, i, 7), close: true,
      });
      // snow on the ridge and along the front edge
      ctx.poly([[cx - hb * 0.96, yB], [cx + hb * 0.96, yB], [cx + hb * 0.8, yB + 9 * sc], [cx - hb * 0.8, yB + 9 * sc]], {
        fill: true, color: 'text', alpha: 0.16 + 0.2 * rand(seed, r, i, 8), close: true,
      });
      ctx.line(cx - hf, yF, cx + hf, yF, { color: 'text', alpha: 0.28, width: lw(ctx, 1.4) });
      ctx.line(cx - hb, yB, cx + hf, yF, { color: 'text', alpha: 0.09, width: lw(ctx, 1.1) });
      // a chimney and an antenna on some roofs
      if (rand(seed, r, i, 9) > 0.58) {
        const chx = cx + (rand(seed, r, i, 10) - 0.5) * bw * 0.4, chy = yB + rh * (0.35 + 0.3 * rand(seed, r, i, 11));
        const chw = Math.max(3, 13 * sc), chh = Math.max(5, 30 * sc);
        ctx.rect(chx - chw / 2, chy - chh, chw, chh, { fill: true, color: 'panel' });
        ctx.rect(chx - chw / 2 - 2 * sc, chy - chh - 3 * sc, chw + 4 * sc, Math.max(2, 4 * sc), { fill: true, color: 'text', alpha: 0.6 });
      }
      if (rand(seed, r, i, 12) > 0.72) {
        const ax = cx + (rand(seed, r, i, 13) - 0.5) * bw * 0.5, ay = yB + rh * 0.2;
        ctx.line(ax, ay, ax, ay - 52 * sc, { color: 'line', width: lw(ctx, 1.2), alpha: 0.8 });
        ctx.line(ax - 14 * sc, ay - 50 * sc, ax + 14 * sc, ay - 50 * sc, { color: 'line', width: lw(ctx, 1.1), alpha: 0.7 });
        ctx.line(ax - 9 * sc, ay - 42 * sc, ax + 9 * sc, ay - 42 * sc, { color: 'line', width: lw(ctx, 1.1), alpha: 0.6 });
      }
    }

    // poles and the local wires of this row; nearer rows will cover their feet
    let prev = null;
    const pSpace = 300 + 260 * sc;
    for (let px = -160 + ((par % pSpace) + pSpace) % pSpace; px < 2080; px += pSpace) {
      const baseY = y + 10 * sc, ph = 150 * sc + 60;
      pole(ctx, px, baseY, ph, { color: 'bg', sc, alpha: 0.96 });
      const top = [px, baseY - ph + 16 * sc];
      if (prev) {
        for (let w = 0; w < 2; w++) {
          const off = (w ? 1 : -1) * 30 * sc;
          const a = [prev[0] + off, prev[1] + w * 6 * sc], b = [top[0] + off, top[1] + w * 6 * sc];
          ctx.poly(wirePts(a, b, (16 + w * 8) * sc, 16), { color: 'line', alpha: 0.68, width: lw(ctx, 1.2) });
        }
      }
      prev = top;
    }
  }

  // ---- the long-distance trunks that cross the whole city --------------------------------------
  const trunks = [
    wirePts([430, 1210], [120, 300], 26, 40),
    wirePts([520, 1210], [980, 282], 40, 40),
    wirePts([620, 1210], [1800, 318], 30, 40),
  ];
  for (const tr of trunks) drawWire(ctx, tr, { color: 'ice', alpha: 0.34, width: 2.2 });

  // ---- the rooftop lightbox (世界中) ------------------------------------------------------------
  let signOut = null;
  if (sign) {
    const sr = rows[sign.row ?? 3] ?? rows[rows.length - 1];
    const sw = sign.w ?? 150, sh = sign.h ?? 430, sx = sign.x ?? 640;
    const sy = sr.y - 34 * sr.sc;                                     // its foot on that row's roof
    const chars = sign.chars ?? [];
    const lit = chars.length ? easeOut(clamp((t - chars[0].t) / 0.3)) : 1;
    // support
    ctx.rect(sx - 5, sy, 10, 54 * sr.sc, { fill: true, color: 'bg' });
    ctx.rect(sx - sw / 2 - 12, sy - sh, sw + 24, sh, { fill: true, color: 'panel' });
    ctx.rect(sx - sw / 2 - 12, sy - sh, sw + 24, sh, { fill: null, stroke: 'line', width: 2.4, alpha: 0.9 });
    ctx.rect(sx - sw / 2, sy - sh + 10, sw, sh - 20, { fill: null, stroke: 'line', width: 1.4, alpha: 0.55 });
    // snow on the top edge
    ctx.rect(sx - sw / 2 - 14, sy - sh - 8, sw + 28, 9, { fill: true, color: 'text', alpha: 0.85 });
    dotLight(ctx, sx, sy - sh / 2, sw * 2.1, 'ice', { alpha: 0.35 + 0.2 * lit, cell: 11 });
    ctx.glow('ice', 26, () => ctx.rect(sx - sw / 2, sy - sh + 8, sw, sh - 16, { fill: null, stroke: 'ice', width: 2, alpha: 0.35 * lit }), lit);
    const n = Math.max(1, chars.length), pitch = (sh - 44) / n;
    chars.forEach((c, i) => {
      if (t < c.t) return;
      const k = easeOut(clamp((t - c.t) / 0.2));
      ctx.text(c.c, sx, sy - sh + 26 + (i + 0.85) * pitch, {
        size: Math.min(sw * 0.82, pitch * 0.86), font: 'serif', weight: 700, color: 'text', align: 'center', alpha: k,
      });
      dotLight(ctx, sx, sy - sh + 26 + (i + 0.5) * pitch, 150, 'ice', { alpha: 0.2 * k, cell: 9 });
    });
    ctx.text(sign.label ?? 'NTT', sx, sy - 8, { size: 15, font: 'mono', weight: 700, color: 'sub', align: 'center', alpha: 0.9 });
    ctx.text('1986', sx, sy + 4, { size: 10, font: 'mono', color: 'mute', align: 'center', alpha: 0.8 });
    signOut = { x: sx - sw / 2, y: sy - sh, w: sw, h: sh };
  }

  // ---- the weather -----------------------------------------------------------------------------
  snow(ctx, t, { count: 190, seed: seed + 5, size: 2.7, speed: 78, wind: 74, alpha: 0.48, camX });
  if (haze > 0) dotFill(ctx, FULL, 'panel', { density: 0.3, cell: 12, alpha: 0.5 * haze, vary: (px, py) => clamp((py - horizon) / 500) });
  return { rows, trunks, sign: signOut };
}

/**
 * One distant apartment block: a dark slab with a grid of windows; one of them (col 3, row 2) can light.
 * Returns the lit window's rect in screen px (the caller may be inside its own transform).
 */
export function windowBlock(ctx, x, y, w, h, { cols = 5, rows = 8, glow = 0, seed = 3, haze = 0.3 } = {}) {
  ctx.at(12, 14, () => ctx.rect(x, y, w, h, { fill: true, color: 'bg', alpha: 0.55 }));
  ctx.rect(x, y, w, h, { fill: true, color: 'panel' });
  ctx.rect(x, y, w, h, { fill: null, stroke: 'line', width: 2, alpha: 0.55 });
  ctx.line(x + w * 0.5, y, x + w * 0.5, y + h, { color: 'line', width: 1.2, alpha: 0.3 });
  // snow on the parapet
  ctx.rect(x - 10, y - 12, w + 20, 13, { fill: true, color: 'text', alpha: 0.7 });
  ctx.line(x - 10, y + 1, x + w + 10, y + 1, { color: 'text', width: 1.4, alpha: 0.4 });
  const cw = w / cols, ch = h / rows;
  let win = null;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const wx = x + cw * (i + 0.2), wy = y + ch * (j + 0.24), ww = cw * 0.58, wh = ch * 0.42;
    if (i === 3 && j === 2) { win = { x: wx, y: wy, w: ww, h: wh }; continue; }
    const lit = rand(seed, i, j) > 0.78;
    ctx.rect(wx, wy, ww, wh, { fill: true, color: lit ? 'youDim' : 'bg', alpha: lit ? 0.34 : 0.9 });
    ctx.line(wx, wy + wh * 0.5, wx + ww, wy + wh * 0.5, { color: 'line', width: 1, alpha: 0.4 });
    ctx.rect(wx, wy, ww, wh, { fill: null, stroke: 'line', width: 1, alpha: 0.35 });
  }
  if (win) {
    const g = clamp(glow);
    if (g > 0.02) {
      dotLight(ctx, win.x + win.w / 2, win.y + win.h / 2, 200, 'you', { alpha: 0.85 * g, cell: 9 });
      dotLight(ctx, win.x + win.w / 2, win.y + win.h / 2, 360, 'youHot', { alpha: 0.3 * g, cell: 11 });
      ctx.glow('you', 40, () => ctx.rect(win.x, win.y, win.w, win.h, { fill: true, color: 'you', alpha: g }), g);
      ctx.rect(win.x, win.y, win.w, win.h, { fill: true, color: 'youHot', alpha: 0.7 * g });
      ctx.rect(win.x, win.y, win.w, win.h, { fill: null, stroke: 'youHot', width: 2.5, alpha: 0.95 * g });
      // the light on the snow of the sill
      dotLight(ctx, win.x + win.w / 2, win.y + win.h + 18, 110, 'you', { alpha: 0.4 * g, sy: 0.4, cell: 8 });
    } else {
      ctx.rect(win.x, win.y, win.w, win.h, { fill: true, color: 'bg', alpha: 0.9 });
      ctx.rect(win.x, win.y, win.w, win.h, { fill: null, stroke: 'line', width: 1.4, alpha: 0.7 });
    }
  }
  dotFill(ctx, { x, y, w, h }, 'panel', { density: 0.22, cell: 10, alpha: haze });
  return win;
}
