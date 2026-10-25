// THE PRINT LANGUAGE of the film (docs/VISUAL.md): every picture is a print. Light is never a smooth gradient on the
// paper - it is a DOT SCREEN whose dots grow where the light is stronger (the only smooth gradient of the film is the
// 恋色 sky at 320.44 s). Objects carry a shadow plate printed out of register; paper grain lies over everything.
//
//   dotLight()   a pool of light as halftone: dot radius follows a soft falloff from (x, y)
//   dotCone()    a beam (lamp, tube light) as halftone, from an apex widening to a base, fading with distance
//   dotFill()    a flat tint screen over a rect / polygon (shading planes, fog)
//   plate()      draw fn twice: its shadow plate in one ink (offset), then itself  (fn(ink) gets the forced ink or null)
//   misreg()     the misregistration of a plate at time t: a small constant offset + a kick after a cut that settles
//   paper()      paper grain + fibres over the whole frame (the overlay layer calls it once per frame)
//   drift()      a slow handheld camera wander (deterministic noise)
// Pure functions of their arguments.
import { noise1, rand } from '../engine/prng.js';
import { clamp } from '../engine/util.js';

// Rasterise stable screens once, then blit their small offscreen canvas.  The
// source is stored in virtual coordinates, so camera transforms still apply at
// draw time.  A screen enters the cache only on its second use: animated
// parameters therefore never allocate a canvas just to be evicted next frame.
const FIELD_CACHE_LIMIT = 12;
const fieldCache = new Map();
const fieldSeen = new Map();
let scratch = null;                                  // the scratch canvas of first-use fields

function cacheKey(ctx, key) {
  const g = ctx.g;
  return `${key}|${ctx.scale}|${g.fillStyle}|${g.globalAlpha}`;
}

function blitField(ctx, key, bounds, cell, draw) {
  const g = ctx.g;
  // Filters/shadows and non-source-over operations alter pixels outside the
  // field or depend on the destination, so retain the immediate draw there.
  if (g.filter !== 'none' || g.shadowBlur || g.globalCompositeOperation !== 'source-over') return false;
  // The field is ALWAYS drawn through a bitmap, rasterised at the current magnification rounded UP to a quarter step:
  // a frame then depends on its own time only, whether the bitmap comes from the cache or is made now (the first
  // version drew a field directly on its first use and from a bitmap afterwards: a frame looked different depending on
  // the frames rendered before it, so pieces of the film rendered separately did not match - found 2026-10-23).
  const m = g.getTransform(), mag = Math.max(1, Math.ceil((Math.hypot(m.a, m.b) / ctx.scale) * 4 - 1e-6) / 4);
  const ck = `${cacheKey(ctx, key)}|${mag}`, hit = fieldCache.get(ck);
  if (hit) {
    fieldCache.delete(ck); fieldCache.set(ck, hit);
    g.save(); g.globalAlpha = 1; g.drawImage(hit.canvas, 0, 0, hit.canvas.width, hit.canvas.height, hit.x, hit.y, hit.canvas.width / (ctx.scale * mag), hit.canvas.height / (ctx.scale * mag)); g.restore();
    return true;
  }

  // a field seen for the first time is drawn into the shared scratch canvas (no allocation for one-off, animated
  // fields); from its second use on it gets a canvas of its own in the cache. Both paths give the same pixels.
  const seen = (fieldSeen.get(ck) ?? 0) + 1;
  fieldSeen.set(ck, seen);
  if (fieldSeen.size > 160) fieldSeen.delete(fieldSeen.keys().next().value);
  const pad = cell * 2 + 2, s = ctx.scale * mag;
  const x = bounds.x - pad, y = bounds.y - pad, w = bounds.w + pad * 2, h = bounds.h + pad * 2;
  const cw = Math.ceil(w * s), chh = Math.ceil(h * s);
  let canvas;
  if (seen >= 2) { canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = chh; }
  else {
    canvas = (scratch ??= document.createElement('canvas'));
    if (canvas.width < cw || canvas.height < chh) { canvas.width = Math.max(canvas.width, cw); canvas.height = Math.max(canvas.height, chh); }
  }
  const cg = canvas.getContext('2d');
  cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, cw, chh);
  cg.setTransform(s, 0, 0, s, -x * s, -y * s);
  cg.fillStyle = g.fillStyle; cg.globalAlpha = g.globalAlpha;
  draw(cg);
  if (seen >= 2) {
    fieldCache.set(ck, { canvas, x, y, w, h });
    if (fieldCache.size > FIELD_CACHE_LIMIT) fieldCache.delete(fieldCache.keys().next().value);
  }
  g.save(); g.globalAlpha = 1; g.drawImage(canvas, 0, 0, cw, chh, x, y, cw / s, chh / s); g.restore();
  return true;
}

// `vary` often closes over a static frost/fog mask.  Function identity is not
// useful (callers create a new closure each frame), so fingerprint the actual
// density at every grid point.  This is deliberately the same clamped value
// used to form each dot: changing even one dot selects a new cache entry.
function varyFingerprint(r, cell, angle, density, vary) {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  grid(r, cell, (x, y) => {
    const q = Math.round(clamp(density * vary(x, y)) * 0x7fffffff) | 0;
    a = Math.imul(a ^ q, 0x01000193);
    b = Math.imul((b + q) | 0, 0x85ebca6b);
  }, angle);
  return `${a >>> 0}:${b >>> 0}`;
}



/** Iterate a 45-degree dot grid covering rect r with pitch `cell`; cb(x, y) per dot centre. */
function grid(r, cell, cb, angle = Math.PI / 4) {
  const ca = Math.cos(angle), sa = Math.sin(angle), cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.hypot(r.w, r.h) / 2 + cell;
  for (let v = -R; v <= R; v += cell) for (let u = -R; u <= R; u += cell) {
    const x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
    if (x < r.x - cell || x > r.x + r.w + cell || y < r.y - cell || y > r.y + r.h + cell) continue;
    cb(x, y);
  }
}

/**
 * Halftone pool of light: intensity = alpha * (1 - d / rad) ^ power, dot radius = cell * 0.55 * sqrt(intensity).
 * clip: optional rect the pool is limited to. sy = vertical squash (a pool on the ground: 0.3).
 */
export function dotLight(ctx, x, y, rad, color, { alpha = 1, cell = 12, power = 1.6, sy = 1, clip = null, angle = Math.PI / 4, min = 0.35 } = {}) {
  if (alpha <= 0.003 || rad <= 0) return;
  const g = ctx.g, r = clip ?? { x: x - rad, y: y - rad * sy, w: 2 * rad, h: 2 * rad * sy };
  g.fillStyle = ctx.col(color, 1);
  const draw = (target) => { target.beginPath(); grid(r, cell, (px, py) => {
    const d = Math.hypot(px - x, (py - y) / sy) / rad;
    if (d >= 1) return;
    const k = alpha * Math.pow(1 - d, power), s = cell * 0.55 * Math.sqrt(clamp(k));
    if (s < min) return;
    target.moveTo(px + s, py); target.arc(px, py, s, 0, 6.2832);
  }, angle); target.fill(); };
  const key = `light|${x}|${y}|${rad}|${alpha}|${cell}|${power}|${sy}|${r.x}|${r.y}|${r.w}|${r.h}|${angle}|${min}`;
  if (!blitField(ctx, key, r, cell, draw)) draw(g);
}

/** Beam from apex [x, y] down to a base centred at [bx, by] of half-width hw; intensity fades along and across. */
export function dotCone(ctx, apex, base, hw, color, { alpha = 1, cell = 12, w0 = 20, power = 1.2, angle = Math.PI / 4 } = {}) {
  if (alpha <= 0.003) return;
  const [ax, ay] = apex, [bx, by] = base, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
  const xs = [ax - w0, ax + w0, bx - hw, bx + hw], ys = [ay, by];
  const r = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const g = ctx.g;
  g.fillStyle = ctx.col(color, 1);
  const draw = (target) => { target.beginPath(); grid(r, cell, (px, py) => {
    const along = ((px - ax) * ux + (py - ay) * uy) / L;
    if (along < 0 || along > 1) return;
    const across = Math.abs((px - ax) * -uy + (py - ay) * ux) / (w0 + (hw - w0) * along);
    if (across >= 1) return;
    const k = alpha * Math.pow(1 - along * 0.85, power) * (1 - across * across), s = cell * 0.55 * Math.sqrt(clamp(k));
    if (s < 0.35) return;
    target.moveTo(px + s, py); target.arc(px, py, s, 0, 6.2832);
  }, angle); target.fill(); };
  const key = `cone|${ax}|${ay}|${bx}|${by}|${hw}|${alpha}|${cell}|${w0}|${power}|${angle}`;
  if (!blitField(ctx, key, r, cell, draw)) draw(g);
}

/** Flat tint screen: uniform dots of `density` (0..1 = dot area share) over rect r (or polygon pts). */
export function dotFill(ctx, r, color, { density = 0.3, cell = 10, alpha = 1, pts = null, angle = Math.PI / 4, vary = null } = {}) {
  if (density <= 0 || alpha <= 0.003) return;
  const g = ctx.g;
  g.save();
  if (pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.clip(); }
  g.fillStyle = ctx.col(color, alpha);
  if (pts) {
    g.beginPath();
    grid(r, cell, (px, py) => {
      const d = vary ? clamp(density * vary(px, py)) : density, s = cell * 0.565 * Math.sqrt(d);
      if (s < 0.35) return;
      g.moveTo(px + s, py); g.arc(px, py, s, 0, 6.2832);
    }, angle);
    g.fill();
  } else {
    const draw = (target) => { target.beginPath(); grid(r, cell, (px, py) => {
      const d = vary ? clamp(density * vary(px, py)) : density, s = cell * 0.565 * Math.sqrt(d);
      if (s < 0.35) return;
      target.moveTo(px + s, py); target.arc(px, py, s, 0, 6.2832);
    }, angle); target.fill(); };
    const fingerprint = vary ? `|${varyFingerprint(r, cell, angle, density, vary)}` : '';
    const key = `fill|${r.x}|${r.y}|${r.w}|${r.h}|${density}|${cell}|${angle}${fingerprint}`;
    if (!blitField(ctx, key, r, cell, draw)) draw(g);
  }
  g.restore(); ctx._font = '';
}

/**
 * Misregistration of a plate at time t: [dx, dy] px. base = the constant error of this press run (seeded),
 * plus a kick of `kick` px at `cut` that settles within ~0.5 s (a sheet being pulled), plus a faint wobble on beats.
 */
export function misreg(t, seed, { base = 4, kick = 14, cut = null, beatEnv = 0 } = {}) {
  const a = rand(seed, 1) * 6.283, b = base * (0.6 + 0.4 * rand(seed, 2));
  let dx = Math.cos(a) * b, dy = Math.sin(a) * b;
  if (cut != null && t >= cut) { const k = kick * Math.exp(-(t - cut) * 7) * Math.cos((t - cut) * 30); dx += k; dy += k * 0.35; }
  dx += beatEnv * 3 * Math.cos(a + 1); dy += beatEnv * 3 * Math.sin(a + 1);
  return [dx, dy];
}

/** Draw fn(ink) twice: as its shadow plate (fn('bg') - fn must print in that ink when it is given) offset by off, then itself (fn(null)). */
export function plate(ctx, off, fn, { alpha = 0.9 } = {}) {
  if (off && (off[0] || off[1])) ctx.at(off[0], off[1], () => fn('bg'), { alpha });
  fn(null);
}

let grainTile = null;
function grainCanvas() {
  if (grainTile) return grainTile;
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, v = rand(901, x, y), fibre = rand(903, x >> 4, y) > 0.9 ? 0.6 * rand(907, x, y >> 1) : 0;
    const light = v > 0.5;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = light ? 255 : 0;
    d[i * 4 + 3] = Math.round(255 * clamp(Math.abs(v - 0.5) * 1.2 + fibre));
  }
  g.putImageData(im, 0, 0);
  return (grainTile = c);
}
/** Paper grain over the frame. Fixed to the paper (does not move with the camera): draw it with no camera set. */
export function paper(ctx, { alpha = 0.07, scale = 0.5 } = {}) {
  const g = ctx.g, pat = g.createPattern(grainCanvas(), 'repeat'), a0 = g.globalAlpha;
  pat.setTransform(new DOMMatrix().scale(scale));
  g.globalAlpha = a0 * alpha; g.fillStyle = pat; g.fillRect(0, 0, 1920, 1080); g.globalAlpha = a0;
}

/** Slow handheld wander for ctx.camera(): { x, y, rot } with amplitude amp px. */
export function drift(t, seed = 0, amp = 8) {
  return { x: amp * noise1(t * 0.23, seed), y: amp * 0.6 * noise1(t * 0.19, seed + 7), rot: 0.0025 * (amp / 8) * noise1(t * 0.13, seed + 13) };
}

/** A beat envelope: 1 on each beat, decaying (stateless). */
export function beatEnv(env, t, decay = 6) {
  const P = env.features.period, t0 = env.features.t0;
  if (t < t0) return 0;
  return Math.exp(-decay * ((t - t0) % P));
}

/**
 * Near snow: a few big flat flakes crossing close to the lens (out of focus = big pale discs), fast, with a short
 * motion trail. Deterministic.
 */
export function nearSnow(ctx, t, { count = 10, seed = 3, color = 'text', alpha = 0.22, size = 26, speed = 260, wind = 90 } = {}) {
  const g = ctx.g;
  g.fillStyle = ctx.col(color, alpha);
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const per = (1080 + 300) / (speed * (0.7 + 0.6 * rand(seed, i, 1))), ph = rand(seed, i, 2) * per, u = ((t + ph) % per) / per;
    const y = -150 + u * 1380, x = ((rand(seed, i, 3) * 2200 + u * wind * per) % 2200) - 140, s = size * (0.6 + 0.8 * rand(seed, i, 4));
    g.moveTo(x + s, y); g.arc(x, y, s, 0, 6.2832);
  }
  g.fill();
}


/** A ring of dots (a sound spreading, a ripple): annulus of radius r and width w around (x, y). */
export function dotRing(ctx, x, y, r, w, color, { alpha = 1, cell = 10, sy = 1 } = {}) {
  if (alpha <= 0.003 || r <= 0) return;
  const g = ctx.g, R = r + w;
  g.fillStyle = ctx.col(color, 1);
  const field = { x: x - R, y: y - R * sy, w: 2 * R, h: 2 * R * sy };
  const draw = (target) => { target.beginPath(); grid(field, cell, (px, py) => {
    const d = Math.abs(Math.hypot(px - x, (py - y) / sy) - r) / w;
    if (d >= 1) return;
    const s = cell * 0.55 * Math.sqrt(alpha * (1 - d * d));
    if (s < 0.35) return;
    target.moveTo(px + s, py); target.arc(px, py, s, 0, 6.2832);
  }); target.fill(); };
  const key = `ring|${x}|${y}|${r}|${w}|${alpha}|${cell}|${sy}`;
  if (!blitField(ctx, key, field, cell, draw)) draw(g);
}
