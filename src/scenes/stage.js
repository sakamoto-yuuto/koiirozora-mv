// Putting the ONE art layer on screen (docs/STORYBOARD_v2.md §0): every person, object and place is a codex print.
// Two kinds of source (art_src/v2/ingest.py):
//   art     three-ink figures (her): env.art, printed plate by plate, the navy plate slightly out of register
//   plates  multi-ink pictures (backgrounds, him, passers-by, objects): env.plates, re-coloured by palette role
// fig() draws either kind by name, so a shot does not care where a picture came from. Positions are given by the
// figure's FOOT (or bottom) point and height: fit(name, x, y, h) -> dst.
import { misreg, beatEnv } from '../components/print.js';

/** Which store holds `name`: 'art' | 'plates' | null. */
export const kind = (env, name) => (env.art?.dim?.[name] ? 'art' : env.plates?.has(name) ? 'plates' : null);

/** Natural size of a picture in source px. */
export function sizeOf(env, name) {
  const k = kind(env, name);
  return k === 'art' ? env.art.size(name) : k === 'plates' ? env.plates.size(name) : { w: 1, h: 1 };
}

/** dst rect of `name` standing with its bottom centre at (x, y), h tall (w from the picture's aspect). crop: source rect. */
export function fit(env, name, x, y, h, crop = null) {
  const s = crop ?? sizeOf(env, name), w = (h * s.w) / s.h;
  return { x: x - w / 2, y: y - h, w, h };
}

/**
 * A figure or object. opts:
 *   at, seed     the cut time and a seed for the misregistration (the navy plate is kicked on the cut, then settles)
 *   roles        art: { cream, orange, black } (default text / me / bg); plates: re-assigned inks (see plates.js)
 *   flip, alpha, crop
 *   breathe      0..1: a 0.6 % scale pulse about the bottom (a person breathing); default 1 for art, 0 for plates
 *   shadow       plates only: the offset navy print behind the picture (default true)
 */
export function fig(ctx, env, name, dst, t, { at = null, seed = 11, roles = null, flip = false, alpha = 1, crop = null, breathe = null, shadow = true, kick = 14 } = {}) {
  const k = kind(env, name);
  if (!k || !(alpha > 0.003)) return;
  const br = 1 + 0.006 * (breathe ?? (k === 'art' ? 1 : 0)) * Math.sin(t * 1.7 + seed);
  const d = { x: dst.x - (dst.w * (br - 1)) / 2, y: dst.y - dst.h * (br - 1), w: dst.w * br, h: dst.h * br };
  const off = misreg(t, seed, { base: 5, kick, cut: at, beatEnv: 0.4 * beatEnv(env, t, 5) });
  if (k === 'art') {
    env.art.inks(ctx, name, d, { roles: roles ?? { cream: 'text', orange: 'me', black: 'bg' }, offset: { black: off, orange: [off[0] * -0.3, 0] }, alpha, flip, crop });
    return;
  }
  if (shadow) ctx.at(off[0], off[1], () => env.plates.draw(ctx, name, d, { crop: crop ?? { x: 0, y: 0, ...env.plates.size(name) }, tint: 'panel', alpha: alpha * 0.55, flip }));
  env.plates.draw(ctx, name, d, { crop: crop ?? { x: 0, y: 0, ...env.plates.size(name) }, roles: roles ?? {}, alpha, flip });
}

/** A background plate filling the frame (or dst): focus [u, v] in 0..1 of the plate, zoom, blur in virtual px (out of focus). */
export function backdrop(ctx, env, name, { dst = { x: -60, y: -40, w: 2040, h: 1160 }, focus = [0.5, 0.5], zoom = 1, roles = {}, blur = 0, alpha = 1, crop = null } = {}) {
  const g = ctx.g;
  if (blur > 0) { g.save(); g.filter = `blur(${blur * ctx.scale}px)`; }
  env.plates.draw(ctx, name, dst, { focus, zoom, roles, alpha, crop });
  if (blur > 0) { g.restore(); ctx._font = ''; }
}

/** Where a point of a plate (u, v in 0..1) lands when the plate is drawn as backdrop(dst, focus, zoom). */
export function plateAt(env, name, u, v, { dst = { x: -60, y: -40, w: 2040, h: 1160 }, focus = [0.5, 0.5], zoom = 1, crop = null } = {}) {
  const P = env.plates.size(name), c = crop ?? env.plates.cover(name, dst, { focus, zoom });
  return [dst.x + ((u * P.w - c.x) / c.w) * dst.w, dst.y + ((v * P.h - c.y) / c.h) * dst.h, dst.w / c.w];   // [x, y, px per plate px]
}
