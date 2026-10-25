// Background plates: whole codex screenprints (streets, rooms, the platform), never keyed, never redrawn.
// tools/plate_art.py turns each into an INK-LABEL MAP (assets/plates/<name>.png, pixel = 16 * ink) plus its inks and
// their default palette roles (<name>.json). Keyed objects (the train car) are plates too: label 255 = transparent. Here every ink is printed in a palette ROLE, so a plate follows the
// film's colour state like everything else (docs/PLAN.md §2): the grey intro greys the street, memory warms it.
//
//   plates.draw(ctx, name, dst, opts)   the plate (or a crop of it) into dst
//   plates.cover(name, dst, opts)       the crop of the plate that fills dst (focus in 0..1 of the plate, zoom)
//   plates.inks(name)                   [{ rgb, role, n }] as the .json has them (n = share of the picture)
//
// opts.roles re-assigns inks for one shot: keys are an ink's DEFAULT role ('youHot' = the warm lights of a night
// plate) or its index; values are palette roles, '#rrggbb', or null (= not printed). opts.only = list of such keys:
// print only those inks (the lights of a street, drawn again over a dark copy, can then switch on one by one).
// opts.tint = one role for every ink (the misregistered shadow print of a figure).
//
// The re-coloured bitmaps are cached by their exact colours (inside a palette fade the plate is rebuilt every frame:
// one table lookup per pixel, ~10 ms); nothing reads pixels while the film renders.
import { clamp } from './util.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const CACHE = 10;                                            // re-coloured bitmaps kept (each w * h * 4 bytes; a time-lapse uses 3 big ones + figures)

export const plateNames = (cfg) => cfg.plates || [];

export async function loadPlates(cfg, step = () => {}) {
  const dir = cfg.paths.plates ?? 'assets/plates', P = new Plates();
  await Promise.all(plateNames(cfg).map(async (name) => {
    const [meta, img] = await Promise.all([
      fetch(`/${dir}/${name}.json`).then((r) => r.json()),
      (async () => { const im = new Image(); im.src = `/${dir}/${name}.png`; await im.decode(); return im; })(),
    ]);
    P._prepare(name, img, meta);
    await step(`plate  ${name}`);
  }));
  return P;
}

export class Plates {
  constructor() { this.p = {}; this.cache = new Map(); }

  _prepare(name, img, meta) {
    const W = img.naturalWidth, H = img.naturalHeight, c = mk(W, H), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data, label = new Uint8Array(W * H), n = meta.inks.length;
    for (let i = 0; i < label.length; i++) label[i] = px[i * 4] >= 248 ? n : Math.min(n - 1, Math.round(px[i * 4] / 16));   // the only read-back, once; n = transparent (keyed objects)
    this.p[name] = { w: W, h: H, label, inks: meta.inks };
  }

  has(name) { return !!this.p[name]; }
  size(name) { const p = this.p[name]; return { w: p.w, h: p.h }; }
  inks(name) { return this.p[name]?.inks ?? []; }

  /** Source crop of the plate that covers dst: focus = [u, v] in 0..1 of the plate, zoom 1 = the widest crop. */
  cover(name, dst, { focus = [0.5, 0.5], zoom = 1 } = {}) {
    const { w: W, h: H } = this.size(name), ar = dst.w / dst.h;
    const cw = Math.min(W, H * ar) / zoom, ch = cw / ar;
    return { x: clamp(focus[0] * W - cw / 2, 0, Math.max(0, W - cw)), y: clamp(focus[1] * H - ch / 2, 0, Math.max(0, H - ch)), w: cw, h: ch };
  }

  /** [r, g, b, a] per ink for this shot (a = 0: not printed). */
  _colours(ctx, P, roles, only, tint = null) {
    return P.inks.map((ink, k) => {
      if (tint) { const m = /rgba\((\d+),(\d+),(\d+)/.exec(ctx.col(tint, 1)); return [+m[1], +m[2], +m[3], 255]; }
      const key = roles[k] !== undefined ? k : ink.role;
      if (only && !only.includes(k) && !only.includes(ink.role)) return [0, 0, 0, 0];
      const role = roles[key] !== undefined ? roles[key] : ink.role;
      if (role == null) return [0, 0, 0, 0];
      const m = /rgba\((\d+),(\d+),(\d+)/.exec(ctx.col(role, 1));
      return [+m[1], +m[2], +m[3], 255];
    });
  }

  _bitmap(name, cols) {
    const key = `${name}|${cols.map((c) => c.join(',')).join(';')}`;
    let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }  // most recently used last
    const P = this.p[name];
    if (this.cache.size >= CACHE) { const [k0, old] = this.cache.entries().next().value; this.cache.delete(k0); this._spare = old; }
    c = this._spare && this._spare.width === P.w && this._spare.height === P.h ? this._spare : mk(P.w, P.h);
    this._spare = null;
    const g = c.getContext('2d'), im = g.createImageData(P.w, P.h), out = new Uint32Array(im.data.buffer);
    const lut = new Uint32Array([...cols.map(([r, gg, b, a]) => ((a << 24) | (b << 16) | (gg << 8) | r) >>> 0), 0]);   // little-endian RGBA; last = transparent
    const L = P.label;
    for (let i = 0; i < L.length; i++) out[i] = lut[L[i]];
    g.putImageData(im, 0, 0);
    this.cache.set(key, c);
    return c;
  }

  /**
   * The plate into dst (virtual px). crop = source rect (default: cover(dst, { focus, zoom })); alpha; roles / only
   * as above; flip = mirrored left to right.
   */
  draw(ctx, name, dst = { x: 0, y: 0, w: 1920, h: 1080 }, { crop = null, focus, zoom, roles = {}, only = null, tint = null, alpha = 1, flip = false } = {}) {
    const P = this.p[name];
    if (!P) { if (!this._warned?.has(name)) { (this._warned ??= new Set()).add(name); console.warn(`[plates] no plate "${name}" (config.json -> plates)`); } return; }
    if (!(alpha > 0.003)) return;
    const c = crop ?? this.cover(name, dst, { focus, zoom }), bmp = this._bitmap(name, this._colours(ctx, P, roles, only, tint)), g = ctx.g, a0 = g.globalAlpha;
    g.save();
    g.globalAlpha = a0 * alpha;
    if (flip) { g.translate(dst.x + dst.w, dst.y); g.scale(-1, 1); g.drawImage(bmp, c.x, c.y, c.w, c.h, 0, 0, dst.w, dst.h); }
    else g.drawImage(bmp, c.x, c.y, c.w, c.h, dst.x, dst.y, dst.w, dst.h);
    g.restore();
  }
}
