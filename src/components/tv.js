// THE BROADCAST, the third kind of picture (docs/PLAN.md §3), used only in V2 (186.61 - 212.21 s).
// A 1986 electronics shop window at night: eleven CRT sets of different sizes stacked behind the glass, all showing
// the same live music-festival broadcast (明星音楽祭 生放送): her on stage, the spotlights, the crowd, the captions.
//
// The broadcast is drawn ONCE per frame into a scratch canvas (1280 x 960, the 4:3 shape of the tubes) and then
// printed into every set, so all the screens really show the same instant. Each set adds its own small life: scan
// roll, a curved-glass sheen of dots, channel flicker on the cuts, a price tag. Outside, in the snow, she stands
// alone, seen from behind, looking at herself on all the screens; her reflection is a halftone ghost in the glass.
//
//   buildBroadcast()   the live picture, as a canvas: 'stage' (wide) or 'close' (the same close-up for every set)
//   tvWall()           the sets, the shelves, the shop interior (inside the window clip of shopWindow())
//   shopWindow()       the whole place: street, facade, window, glass, the TVs, the snow, her, the street
//   tvSet()            one set (also used by the check cards)
//
// Pure functions of (ctx, env, t): nothing here touches the DOM at import time (the scratch canvas is lazy).
import { rand } from '../engine/prng.js';
import { clamp, easeOut, prog } from '../engine/util.js';
import { dotLight, dotCone, dotFill } from './print.js';
import { snow } from './world.js';

const BW = 1280, BH = 960;
const WIN = { x: 110, y: 150, w: 1440, h: 750 };                 // the shop window (world coordinates)
const TV_ROLES = { cream: 'text', orange: 'me', black: 'panel' }; // cream / wine / navy, as the palette prints them

/** The sets in the window: x, y and width (height 0.77 w: a 4:3 tube plus a control strip). Right edges stop at
 *  1190 so the last 380 px of the frame stay calm for her lyric column. */
const SETS = [
  { x: 150, y: 176, w: 250, brand: 'COLOR', price: null },
  { x: 430, y: 168, w: 320, brand: 'CRT', price: '¥98,000' },
  { x: 790, y: 180, w: 280, brand: 'COLOR', price: null },
  { x: 1040, y: 240, w: 150, brand: 'COLOR', price: null },
  { x: 140, y: 440, w: 280, brand: 'COLOR', price: '¥39,800' },
  { x: 450, y: 452, w: 250, brand: 'CRT', price: '¥44,800' },
  { x: 760, y: 430, w: 390, brand: 'COLOR', price: '¥59,800' },
  { x: 170, y: 720, w: 230, brand: 'COLOR', price: null },
  { x: 440, y: 730, w: 195, brand: 'CRT', price: null },
  { x: 700, y: 720, w: 250, brand: 'COLOR', price: '¥24,800' },
  { x: 980, y: 735, w: 200, brand: 'COLOR', price: null },
];
const tvH = (w) => w * 0.77;

let scratch = null;
const scratchCanvas = () => (scratch ??= (() => { const c = document.createElement('canvas'); c.width = BW; c.height = BH; return c; })());

/** Run fn with ctx.g pointing at another canvas (the scratch); text and shapes keep their palette / fonts. */
function withG(ctx, g, fn) {
  const keep = ctx.g;
  ctx.g = g; ctx._font = '';
  try { fn(); } finally { ctx.g = keep; ctx._font = ''; }
}

/** Print one silhouette plate into the scratch: art.inks only needs g / scale / col / _font. */
function artPrint(ctx, env, name, dst, opts) {
  if (!env.art) return;
  const a = { g: ctx.g, scale: 1, col: (n, al) => ctx.col(n, al), _font: '' };
  env.art.inks(a, name, dst, opts);
}

// ------------------------------------------------------------------------------------------------ the broadcast

/** The live picture: the festival stage or, after the cut, the same close-up of her on every screen. */
export function buildBroadcast(ctx, env, t, { close = false, waveFrom = 0, waveTo = 0, since = 0 } = {}) {
  const c = scratchCanvas(), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, BW, BH);
  withG(ctx, g, () => {
    if (close) broadcastClose(ctx, env, t, since);
    else broadcastStage(ctx, env, t, { waveFrom, waveTo });
    broadcastFinish(ctx, t, { close });
  });
  return c;
}

/** The stage: lights as dot cones, her at the microphone, the crowd as a halftone field, the lower thirds. */
function broadcastStage(ctx, env, t, { waveFrom = 0, waveTo = 0 } = {}) {
  const sway = Math.sin(t * 0.33) * 8, push = 1 + 0.012 * Math.sin(t * 0.21);
  // the back of the hall: a flat wall, the light bars of a 1986 music show, a big halo behind her
  ctx.rect(0, 0, BW, BH, { fill: true, color: 'panel' });
  ctx.rect(0, 0, BW, 760, { fill: true, color: 'raised', alpha: 0.62 });
  dotFill(ctx, { x: 0, y: 0, w: BW, h: 760 }, 'panel', { density: 0.22, cell: 18, alpha: 0.35, vary: (px, py) => 0.4 + 0.6 * clamp((py - 80) / 680) });
  ctx.rect(110, 48, 1060, 700, { color: 'line', alpha: 0.55, width: 3 });
  ctx.rect(128, 66, 1024, 664, { color: 'text', alpha: 0.12, width: 1.5 });
  dotLight(ctx, 640, 330, 470, 'ice', { alpha: 0.32, cell: 15, clip: { x: 0, y: 0, w: BW, h: 760 } });
  for (let i = 0; i < 7; i++) {
    const x = 70 + i * 176;
    ctx.rect(x, 70, 30, 640, { fill: true, color: 'raised', alpha: 0.75 });
    ctx.rect(x + 10, 70, 5, 640, { fill: true, color: 'ice', alpha: 0.24 + 0.1 * Math.sin(t * 1.3 + i) });
  }
  // stage lights: four halftone cones from the rig, one of them wine
  for (const [x, bx, hw, col, a] of [[150, 470, 170, 'ice', 0.42], [430, 600, 190, 'text', 0.24], [850, 690, 210, 'meHot', 0.36], [1130, 810, 170, 'ice', 0.4]]) {
    dotCone(ctx, [x + Math.sin(t * 0.5 + x) * 6, -30], [bx, 760], hw, col, { alpha: a, cell: 14, w0: 12 });
  }
  // stage floor and footlights
  ctx.rect(0, 742, BW, BH - 742, { fill: true, color: 'raised' });
  ctx.rect(0, 736, BW, 8, { fill: true, color: 'line' });
  ctx.rect(0, 728, BW, 8, { fill: true, color: 'ice', alpha: 0.22 });
  for (let i = 0; i < 24; i++) ctx.circle(36 + i * 53, 748, 4, { fill: true, color: 'ice', alpha: 0.24 + 0.14 * Math.sin(t * 2.1 + i) });
  // her, printed cream / wine / navy
  const dw = 700 * push, dh = dw * 1448 / 1086, bob = 2.5 * Math.sin(t * 1.15);
  artPrint(ctx, env, 'y_stage', { x: 640 - dw / 2 + sway, y: 18 + bob, w: dw, h: dh }, {
    roles: TV_ROLES, offset: { black: [3, 4], orange: [-2, 0] }, alpha: 1,
  });
  // a little RGB fringing at the edges of the figure (slight misregistration, baked into the picture once)
  artPrint(ctx, env, 'y_stage', { x: 640 - dw / 2 + sway, y: 18 + bob, w: dw, h: dh }, {
    plates: [{ ink: 'cream', role: 'ice', offset: [3, 0], alpha: 0.2 }, { ink: 'orange', role: 'meHot', offset: [-3, 0], alpha: 0.18 }],
    alpha: 0.22,
  });
  // the crowd: round heads in five rows, a dot screen behind them, a wave of lifted / brightened heads on 微笑み
  crowd(ctx, t, { waveFrom, waveTo });
  // the programme's lower thirds (Noto Sans JP; all in the sans whitelist)
  captions(ctx, t, { close: false, k: clamp((t - 186.9) / 0.9) });
}

/** The same close-up of her on every screen (y_eye, cropped to the tube): the cut at 205.01 s. */
function broadcastClose(ctx, env, t, since) {
  ctx.rect(0, 0, BW, BH, { fill: true, color: 'panel' });
  dotLight(ctx, 640, 400, 760, 'me', { alpha: 0.3, cell: 18 });
  if (env.art) {
    const crop = env.art.cover('y_eye', { w: BW, h: BH }, { zoom: 1.14 + 0.03 * clamp(since / 6) });
    artPrint(ctx, env, 'y_eye', { x: 0, y: 0, w: BW, h: BH }, {
      crop, roles: { cream: 'text', orange: 'meHot', black: 'panel' },
      offset: { black: [3, 2], orange: [-3, 0] }, alpha: 1,
    });
    artPrint(ctx, env, 'y_eye', { x: 0, y: 0, w: BW, h: BH }, {
      crop, plates: [{ ink: 'cream', role: 'ice', offset: [3, 0], alpha: 0.18 }, { ink: 'orange', role: 'meHot', offset: [-3, 0], alpha: 0.2 }],
      alpha: 0.2,
    });
  }
  captions(ctx, t, { close: true, k: clamp(since / 0.4) });
}

/** The crowd: a halftone field of small heads; on 微 / 笑 / み a wave lifts and brightens them left to right. */
function crowd(ctx, t, { waveFrom = 0, waveTo = 0 } = {}) {
  dotFill(ctx, { x: 0, y: 748, w: BW, h: BH - 748 }, 'ice', { density: 0.2, cell: 14, alpha: 0.5, vary: (px, py) => 0.3 + 0.7 * clamp((py - 748) / 200) });
  const rows = [
    { y: 786, r: 10, step: 21 }, { y: 820, r: 13, step: 28 }, { y: 860, r: 17, step: 36 },
    { y: 906, r: 22, step: 47 }, { y: 956, r: 28, step: 60 },
  ];
  let i = 0;
  for (const row of rows) {
    for (let x = -20 + (i % 2) * row.step * 0.5; x < BW + 20; x += row.step) {
      const u = clamp(x / BW), ph = rand(3, i, 1) * 6.283;
      // the wave reaches a head at its place in the line, between 微笑み's first and last sung character
      const reach = waveTo > waveFrom ? waveFrom + (waveTo - waveFrom) * u : -1e9;
      const k = waveTo > waveFrom ? clamp((t - reach) / 0.55) : 0;
      const lift = row.r * 0.9 * Math.sin(Math.PI * Math.min(1, k)) + row.r * 0.12 * Math.sin(t * 1.7 + ph);
      const bright = 0.25 + 0.75 * Math.sin(Math.PI * clamp(k));
      // shoulders and the back of a head: a dark silhouette against the lit floor
      ctx.rrect(x - row.r * 1.45, row.y - lift + row.r * 0.5, row.r * 2.9, row.r * 1.7, row.r * 0.7, { fill: 'panel', alpha: 0.72 });
      ctx.circle(x, row.y - lift, row.r, { fill: true, color: 'panel', alpha: 0.96 });
      ctx.circle(x, row.y - lift, row.r, { color: 'line', width: 1.8, alpha: 0.4 + 0.35 * bright });
      ctx.circle(x - row.r * 0.26, row.y - lift - row.r * 0.34, row.r * 0.34, { fill: true, color: 'text', alpha: 0.18 + 0.6 * bright });
      if (bright > 0.62 && rand(5, i, 2) > 0.55) {                   // a few hands up (a shared smile, not a face)
        const hx = x + row.r * (rand(5, i, 3) - 0.5) * 2, hy = row.y - lift - row.r * 1.5;
        ctx.line(hx, row.y - lift - row.r * 0.4, hx, hy, { color: 'text', alpha: 0.24 + 0.45 * bright, width: 2.8 });
      }
      i++;
    }
  }
}

/** Programme captions: the show's bug top left, 生放送 with a live dot top right, 森川由綺 as the lower third. */
function captions(ctx, t, { close = false, k = 1 } = {}) {
  const blink = 0.55 + 0.45 * Math.sin(t * 6.4);
  ctx.rect(38, 36, 468, 92, { fill: true, color: 'panel', alpha: 0.82 * k });
  ctx.rect(38, 36, 9, 92, { fill: true, color: 'me', alpha: k });
  ctx.text('第1回', 62, 66, { size: 20, font: 'sans', weight: 700, color: 'sub', alpha: k });
  ctx.text('明星音楽祭', 62, 108, { size: 42, font: 'sans', weight: 900, color: 'text', alpha: k });
  ctx.rect(1012, 38, 230, 70, { fill: true, color: 'panel', alpha: 0.8 * k });
  ctx.rect(1012, 38, 230, 70, { color: 'err', width: 2, alpha: 0.7 * k });
  ctx.circle(1042, 73, 9, { fill: true, color: 'err', alpha: blink * k });
  ctx.text('生放送', 1064, 86, { size: 34, font: 'sans', weight: 900, color: 'text', alpha: k });
  const lk = easeOut(clamp(k));
  ctx.rect(0, 850, 720, 76 + (1 - lk) * 30, { fill: true, color: 'panel', alpha: 0.86 * lk });
  ctx.rect(0, 850, 720, 5, { fill: true, color: 'me', alpha: lk });
  ctx.rect(28, 868, 54, 50, { fill: true, color: 'text', alpha: lk });
  ctx.text('祭', 55, 906, { size: 34, font: 'sans', weight: 900, color: 'panel', align: 'center', alpha: lk });
  ctx.text('森川由綺', 100, 910, { size: 42, font: 'sans', weight: 900, color: 'text', alpha: lk });
  ctx.text('恋色空', 520, 912, { size: 26, font: 'sans', weight: 700, color: 'sub', alpha: lk });
  if (!close) ctx.text('中継', 692, 912, { size: 20, font: 'sans', weight: 700, color: 'line', alpha: 0.8 * k, align: 'right' });
}

/** CRT finish baked once: scanlines, a faint vignette, a rolling sync band. */
function broadcastFinish(ctx, t, { close = false } = {}) {
  const g = ctx.g;
  g.fillStyle = ctx.col('panel', 0.2);
  for (let y = 0; y < BH; y += 5) g.fillRect(0, y, BW, 1.6);
  g.fillStyle = ctx.col('text', 0.035);
  for (let y = 2; y < BH; y += 40) g.fillRect(0, y, BW, 1);
  const roll = ((t * 0.16) % 1) * BH;
  ctx.rect(0, roll, BW, 26, { fill: true, color: 'text', alpha: 0.035 });
  ctx.rect(0, roll + 26, BW, 4, { fill: true, color: 'panel', alpha: 0.16 });
  if (close) ctx.rect(0, 0, BW, BH, { fill: true, color: 'me', alpha: 0.04 });
  // a dark edge, so the tube reads as a tube
  g.fillStyle = ctx.col('panel', 0.34);
  for (let i = 0; i < 6; i++) {
    g.fillRect(0, i * 3, BW, 2); g.fillRect(0, BH - (i + 1) * 3, BW, 2);
    g.fillRect(i * 3, 0, 2, BH); g.fillRect(BW - (i + 1) * 3, 0, 2, BH);
  }
}

// ------------------------------------------------------------------------------------------------ one set

/** One CRT set (cabinet in world px). img = the shared broadcast canvas. */
export function tvSet(ctx, { x, y, w, img, t, seed = 0, cut = null, price = null, brand = 'COLOR', alpha = 1 }) {
  if (alpha <= 0.004) return;
  const h = tvH(w), sw = w * 0.68, sh = sw * 0.75, sx = x + w * 0.055, sy = y + w * 0.06;
  ctx.rrect(x + 9, y + 11, w, h, w * 0.035, { fill: 'bg', alpha: alpha * 0.5 });           // shadow plate
  ctx.rrect(x, y, w, h, w * 0.035, { fill: 'raised', alpha });
  dotFill(ctx, { x, y, w, h }, 'line', { density: 0.12, cell: 9, alpha: alpha * 0.5 });
  ctx.rrect(x, y, w, h, w * 0.035, { fill: null, stroke: 'line', width: 1.5, alpha: alpha * 0.9 });
  ctx.rect(x + w * 0.018, y + w * 0.018, w - w * 0.036, 2, { fill: true, color: 'sub', alpha: alpha * 0.22 });
  // the recess, then the tube
  ctx.rrect(sx - w * 0.016, sy - w * 0.016, sw + w * 0.032, sh + w * 0.032, w * 0.012, { fill: 'panel', alpha });
  ctx.clip({ x: sx, y: sy, w: sw, h: sh }, () => {
    ctx.g.drawImage(img, 0, 0, img.width, img.height, sx, sy, sw, sh);
    const since = cut == null ? 1e9 : t - cut;
    if (since >= 0 && since < 0.22) {
      // channel flicker on the cut: torn bands of the same picture, a white beat, a dark tear
      const fr = Math.floor(t * 60);
      for (let i = 0; i < 4; i++) {
        if (rand(seed, fr, i) < 0.38) continue;
        const by = sy + rand(seed, fr, i + 11) * sh, bh = sh * (0.02 + 0.1 * rand(seed, fr, i + 23));
        const dx = (rand(seed, fr, i + 31) - 0.5) * sw * 0.08;
        ctx.clip({ x: sx, y: by, w: sw, h: bh }, () => {
          ctx.g.drawImage(img, 0, 0, img.width, img.height, sx + dx, sy, sw, sh);
          ctx.rect(sx, by, sw, bh, { fill: true, color: rand(seed, fr, i + 41) > 0.5 ? 'text' : 'panel', alpha: 0.08 + 0.1 * rand(seed, fr, i + 51) });
        });
      }
    }
    // scan roll and a slow flicker of the picture itself
    const roll = ((t * (0.18 + 0.05 * rand(seed, 3)) + rand(seed, 7)) % 1) * sh;
    ctx.rect(sx, sy + roll, sw, sh * 0.07, { fill: true, color: 'text', alpha: 0.035 });
    ctx.rect(sx, sy + roll, sw, 2, { fill: true, color: 'text', alpha: 0.14 });
    ctx.rect(sx, sy, sw, sh, { fill: true, color: 'panel', alpha: 0.03 + 0.05 * Math.abs(Math.sin(t * 2.7 + seed)) });
    // the curved-glass sheen: a pool of dots top left, a thin streak on the right
    dotFill(ctx, { x: sx, y: sy, w: sw, h: sh }, 'text', {
      density: 0.4, cell: Math.max(5, w * 0.018), alpha: alpha * 0.32, vary: (px, py) => {
        const u = (px - sx) / sw, v = (py - sy) / sh;
        return clamp(1 - Math.hypot((u - 0.24) * 1.35, (v - 0.12) * 2.1)) * 0.95 + 0.3 * clamp(1 - Math.abs(u - 0.87) / 0.06) * clamp(1 - v);
      },
    });
  });
  ctx.rect(sx, sy, sw, sh, { color: 'bg', width: 3, alpha: alpha * 0.9 });
  // control column: speaker slots, two knobs, the power lamp
  const cx = sx + sw + w * 0.028, cw = x + w * 0.97 - cx;
  if (cw > w * 0.05) {
    for (let i = 0; i < 4; i++) ctx.rect(cx, y + w * 0.12 + i * w * 0.045, cw * 0.75, w * 0.018, { fill: true, color: 'panel', alpha: alpha * 0.8 });
    for (const ky of [0.36, 0.52]) {
      ctx.circle(cx + cw * 0.36, y + w * ky, w * 0.038, { fill: true, color: 'panel', alpha });
      ctx.circle(cx + cw * 0.36, y + w * ky, w * 0.038, { color: 'line', width: 1.4, alpha: alpha * 0.9 });
      ctx.line(cx + cw * 0.36, y + w * ky, cx + cw * 0.36 + w * 0.026, y + w * ky - w * 0.018, { color: 'sub', width: 1.8, alpha: alpha * 0.8 });
    }
    ctx.circle(x + w * 0.89, y + h - w * 0.06, w * 0.013, { fill: true, color: 'err', alpha });
  }
  // brand, channel and the price tag on its string
  ctx.text(brand, x + w * 0.055, y + h - w * 0.05, { size: w * 0.042, font: 'mono', weight: 700, color: 'mute', alpha });
  ctx.text('4', x + w * 0.92, y + h - w * 0.05, { size: w * 0.042, font: 'mono', color: 'sub', align: 'right', alpha });
}

/** A paper price tag on a string, hung from the bottom edge of a set (drawn after the wall, so it is never buried). */
function priceTag(ctx, { x, y, w, price, alpha = 1 }) {
  const px = x + w * 0.6, py = y;
  ctx.line(px + w * 0.08, py, px + w * 0.08, py + w * 0.1, { color: 'line', width: 1.5, alpha: alpha * 0.9 });
  ctx.rrect(px, py + w * 0.1, w * 0.42, w * 0.13, w * 0.012, { fill: 'text', alpha: alpha * 0.95 });
  ctx.rrect(px, py + w * 0.1, w * 0.42, w * 0.13, w * 0.012, { color: 'line', width: 1.2, alpha: alpha * 0.9 });
  ctx.text(price, px + w * 0.035, py + w * 0.193, { size: w * 0.052, font: 'mono', weight: 700, color: 'panel', alpha });
}

// ------------------------------------------------------------------------------------------------ the shop

/** The shop interior and the wall of sets. Called inside the window clip by shopWindow(). */
export function tvWall(ctx, env, t, { img, cut = null, close = false } = {}) {
  ctx.rect(WIN.x - 20, WIN.y - 20, WIN.w + 40, WIN.h + 40, { fill: true, color: 'panel' });
  dotFill(ctx, { x: WIN.x, y: WIN.y, w: WIN.w, h: WIN.h }, 'line', { density: 0.055, cell: 17, alpha: 0.25, vary: () => 0.5 });
  dotLight(ctx, 760, 170, 620, 'ice', { alpha: 0.22, cell: 18, clip: { x: WIN.x, y: WIN.y, w: WIN.w, h: WIN.h } });
  dotLight(ctx, 660, WIN.y + 10, 500, 'ice', { sy: 0.22, alpha: 0.3, cell: 15, clip: { x: WIN.x, y: WIN.y, w: WIN.w, h: 260 } });
  ctx.rect(WIN.x + 30, WIN.y + 8, 900, 6, { fill: true, color: 'ice', alpha: 0.32 });
  // shelves behind the sets, and the wall seams
  for (const y of [420, 700]) ctx.rect(WIN.x + 10, y, 1150, 9, { fill: true, color: 'line', alpha: 0.6 });
  for (let i = 0; i < 5; i++) ctx.line(WIN.x + 150 + i * 210, WIN.y, WIN.x + 150 + i * 210, WIN.y + WIN.h, { color: 'line', alpha: 0.18, width: 1.2 });
  // the quiet right end: a dark curtain and two speakers on a shelf, so her lyric column stays on paper
  ctx.rect(1200, WIN.y, 350, WIN.h, { fill: true, color: 'bg', alpha: 0.55 });
  for (let i = 0; i < 6; i++) ctx.line(1216 + i * 54, WIN.y + 8, 1208 + i * 54, WIN.y + WIN.h - 8, { color: 'line', alpha: 0.2, width: 1.4 });
  for (const wy of [196, 470]) {
    ctx.rect(1234, wy, 128, 142, { fill: true, color: 'raised', alpha: 0.92 });
    ctx.rect(1234, wy, 128, 142, { color: 'line', width: 1.5, alpha: 0.7 });
    for (const cy of [wy + 40, wy + 98]) {
      ctx.circle(1298, cy, 22, { fill: true, color: 'panel', alpha: 0.95 });
      ctx.circle(1298, cy, 22, { color: 'line', width: 1.2, alpha: 0.6 });
      ctx.circle(1298, cy, 6, { fill: true, color: 'raised' });
    }
  }
  ctx.rect(1210, 630, 176, 5, { fill: true, color: 'line', alpha: 0.7 });
  ctx.text('AUDIO', 1298, 660, { size: 13, font: 'mono', color: 'mute', align: 'center', alpha: 0.7 });
  // the wall of sets, back rows first; the price tags go on last, over the set below
  SETS.forEach((s, i) => tvSet(ctx, { ...s, price: null, img, t, seed: 11 + i, cut, alpha: 1 }));
  SETS.forEach((s) => { if (s.price) priceTag(ctx, { x: s.x, y: s.y + tvH(s.w), w: s.w, price: s.price }); });
  // dust in the tube light
  for (let i = 0; i < 18; i++) {
    const x = WIN.x + rand(21, i, 1) * WIN.w, y = WIN.y + rand(21, i, 2) * WIN.h;
    ctx.circle(x, y, 1.2 + 1.4 * rand(21, i, 3), { fill: true, color: 'text', alpha: 0.10 + 0.08 * Math.sin(t * 1.3 + i) });
  }
}

/**
 * The whole place in world coordinates (1920 x 1080):
 *   img        the broadcast canvas (buildBroadcast)
 *   glassK     0 = the camera is inside, 1 = out on the pavement (glass, frame, reflection, snow)
 *   snowK      0..1 falling snow in front of everything
 *   cut        the shot's cut, for channel flicker on the sets
 *   walkers    1 = the two passers-by are still out there (they leave during 〔L15〕)
 *   reflect    alpha of her halftone reflection in the glass
 */
export function shopWindow(ctx, env, t, { img, glassK = 0, snowK = 1, cut = null, walkers = 1, reflect = 0.18, herK = 1 } = {}) {
  // ---- the street around the shop ----------------------------------------------------------------------------
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel' });
  dotLight(ctx, 220, 650, 900, 'raised', { sy: 0.3, alpha: 0.8, cell: 13 });
  dotLight(ctx, 1700, 300, 520, 'ice', { alpha: 0.16, cell: 15 });
  for (let i = 0; i < 8; i++) {
    const x = -80 + i * 270, h = 120 + 90 * rand(31, i);
    ctx.rect(x, 600 - h, 240, h + 80, { fill: true, color: 'bg', alpha: 0.95 });
    ctx.rect(x, 600 - h, 240, 6, { fill: true, color: 'text', alpha: 0.25 });
    if (i % 3 === 0) ctx.rect(x + 60, 600 - h + 40, 26, 22, { fill: true, color: 'ice', alpha: 0.2 });
  }
  ctx.rect(0, 660, 1920, 420, { fill: true, color: 'raised' });
  dotFill(ctx, { x: 0, y: 660, w: 1920, h: 420 }, 'panel', { density: 0.22, cell: 13, alpha: 0.5, vary: (px, py) => clamp((py - 660) / 420) });
  // a mercury lamp far left and its pool; the right side kept dark
  ctx.rect(66, 300, 12, 380, { fill: true, color: 'bg' });
  ctx.rect(40, 292, 64, 10, { fill: true, color: 'bg' });
  dotCone(ctx, [96, 300], [96, 700], 190, 'ice', { alpha: 0.4, cell: 12 });
  dotLight(ctx, 96, 720, 260, 'ice', { sy: 0.22, alpha: 0.6, cell: 11 });
  // ---- the shop: a 1986 electrical store ----------------------------------------------------------------
  ctx.rrect(40, 40, 1540, 930, 8, { fill: 'raised', alpha: 0.98 });
  ctx.rect(40, 40, 1540, 930, { color: 'line', width: 2, alpha: 0.8 });
  dotFill(ctx, { x: 40, y: 40, w: 1540, h: 930 }, 'line', { density: 0.05, cell: 16, alpha: 0.28, vary: (px, py) => 0.4 + 0.6 * clamp((py - 40) / 900) });
  ctx.rrect(-16, 20, 1650, 30, 14, { fill: 'text', alpha: 0.88 });                       // snow on the roof
  for (let i = 0; i < 3; i++) ctx.line(80 + i * 500, 150, 80 + i * 500, 950, { color: 'line', alpha: 0.35, width: 1.4 });
  // the shop sign: 電器, lit from behind (sans 900)
  const sg = { x: 236, y: 60, w: 470, h: 78 };
  ctx.rrect(sg.x + 8, sg.y + 9, sg.w, sg.h, 4, { fill: 'bg', alpha: 0.45 });
  ctx.rect(sg.x, sg.y, sg.w, sg.h, { fill: true, color: 'ice', alpha: 0.92 });
  ctx.rect(sg.x, sg.y, sg.w, sg.h, { color: 'line', width: 2, alpha: 0.9 });
  ctx.rect(sg.x, sg.y + sg.h - 7, sg.w, 7, { fill: true, color: 'me', alpha: 0.9 });
  ctx.text('電器', sg.x + 154, sg.y + 74, { size: 74, font: 'sans', weight: 900, color: 'panel' });
  dotLight(ctx, sg.x + sg.w / 2, sg.y + sg.h + 60, 360, 'ice', { sy: 0.5, alpha: 0.32, cell: 12 });
  ctx.text('ELECTRIC  /  1986', sg.x + sg.w + 26, sg.y + 58, { size: 16, font: 'mono', color: 'mute', alpha: 0.9 });
  // ---- behind the glass --------------------------------------------------------------------------------------
  ctx.clip(WIN, () => {
    tvWall(ctx, env, t, { img, cut });
    if (glassK > 0.003) {
      // the glass as a print: two diagonal sheens of dots, a pool of the street lamp, the faint ghost of her back
      dotFill(ctx, WIN, 'text', { density: 0.05, cell: 15, alpha: 0.35 * glassK, pts: [[WIN.x, WIN.y + 140], [WIN.x + 620, WIN.y], [WIN.x + 880, WIN.y], [WIN.x + 120, WIN.y + WIN.h], [WIN.x, WIN.y + WIN.h]] });
      dotFill(ctx, WIN, 'ice', { density: 0.04, cell: 18, alpha: 0.3 * glassK, pts: [[WIN.x + 980, WIN.y], [WIN.x + 1180, WIN.y], [WIN.x + 620, WIN.y + WIN.h], [WIN.x + 430, WIN.y + WIN.h]] });
      dotLight(ctx, WIN.x + 230, WIN.y + 300, 420, 'ice', { alpha: 0.18 * glassK, cell: 14, clip: WIN });
      if (env.art && reflect > 0.003 && herK > 0.01) {
        env.art.halftone(ctx, 'y_back_full', { x: 930, y: 470, w: 310, h: 414 }, {
          color: 'text', cell: 7, alpha: reflect * glassK * herK, flip: true,
        });
      }
      // the glass surface itself: a couple of hairlines and a dark bottom edge
      ctx.line(WIN.x, WIN.y + 120, WIN.x + WIN.w, WIN.y + 120, { color: 'text', alpha: 0.06 * glassK, width: 2 });
      ctx.line(WIN.x + 300, WIN.y, WIN.x + 40, WIN.y + WIN.h, { color: 'text', alpha: 0.07 * glassK, width: 3 });
    }
  });
  // ---- the window frame, mullions and sill (only from outside) ----------------------------------------------
  if (glassK > 0.003) {
    const a = glassK;
    ctx.rect(WIN.x - 18, WIN.y - 18, WIN.w + 36, 18, { fill: true, color: 'sub', alpha: a });
    ctx.rect(WIN.x - 18, WIN.y + WIN.h, WIN.w + 36, 30, { fill: true, color: 'raised', alpha: a });
    for (const x of [WIN.x + 315, WIN.x + 645, WIN.x + 1090]) ctx.rect(x, WIN.y, 14, WIN.h, { fill: true, color: 'sub', alpha: a * 0.9 });
    ctx.rect(WIN.x, WIN.y - 10, WIN.w, 10, { fill: true, color: 'raised', alpha: a });
    ctx.rect(WIN.x - 22, WIN.y - 18, WIN.w + 44, 18, { color: 'line', width: 2, alpha: a * 0.8 });
    ctx.rrect(WIN.x - 30, WIN.y + WIN.h + 4, WIN.w + 60, 34, 4, { fill: 'raised', alpha: a });
    ctx.rrect(WIN.x - 30, WIN.y + WIN.h + 4, WIN.w + 60, 10, 3, { fill: 'text', alpha: a });
    ctx.line(WIN.x - 30, WIN.y + WIN.h + 38, WIN.x + WIN.w + 30, WIN.y + WIN.h + 38, { color: 'line', width: 2, alpha: a * 0.8 });
    ctx.text('TV / 1986', WIN.x + WIN.w + 44, WIN.y + 60, { size: 15, font: 'mono', color: 'mute', alpha: a * 0.8 });
  }
  // ---- pavement, the passers-by, her ------------------------------------------------------------------------
  if (herK > 0.003) {
    // the snow-covered pavement: lighter than the shop wall, with a curb and a bank at the bottom edge
    ctx.rect(0, 936, 1920, 144, { fill: true, color: 'line', alpha: 0.55 * Math.min(1, herK * 2) });
    ctx.rect(0, 936, 1920, 6, { fill: true, color: 'sub', alpha: 0.7 * Math.min(1, herK * 2) });
    dotFill(ctx, { x: 0, y: 936, w: 1920, h: 144 }, 'ice', { density: 0.28, cell: 10, alpha: 0.5 * Math.min(1, herK * 2), vary: (px, py) => 0.35 + 0.65 * clamp((py - 936) / 144) });
    dotLight(ctx, 900, 1000, 720, 'ice', { sy: 0.22, alpha: 0.24 * Math.min(1, herK * 2), cell: 12 });
    ctx.poly([[-20, 1090], [60, 1014], [420, 1032], [820, 1012], [1220, 1030], [1620, 1012], [1940, 1040], [1940, 1090]], { fill: true, color: 'text', alpha: 0.1 * herK, close: true });
    ctx.line(0, 1046, 1920, 1046, { color: 'text', alpha: 0.14 * herK, width: 2 });
    if (walkers > 0.01) pedestrians(ctx, t, walkers * herK);
    drawHer(ctx, env, t, { x: 1255, y: 972, h: 380, alpha: herK });
  }
  // snow across everything in front
  if (snowK > 0.003) {
    snow(ctx, t, { count: 210, seed: 61, size: 3.2, alpha: 0.72 * snowK, wind: 26, speed: 62 });
    snow(ctx, t, { count: 70, seed: 67, size: 5.2, alpha: 0.4 * snowK, wind: 40, speed: 110, depth: [0.8, 1.8] });
  }
}

/** Her, outside, from behind, small: breathing, the navy plate a little out of register, a shadow on the snow. */
function drawHer(ctx, env, t, { x, y, h = 360, alpha = 1 }) {
  const w = h * 1086 / 1448, br = 1 + 0.006 * Math.sin(t * 1.6);
  const ww = w * br, hh = h * br;
  dotFill(ctx, { x: x - w * 0.7, y: y - 14, w: w * 1.4, h: 30 }, 'panel', { density: 0.6, cell: 8, alpha: 0.55 * alpha, vary: (px, py) => clamp(1 - Math.hypot((px - x) / (w * 0.7), (py - (y - 6)) / 16)) });
  if (env.art) {
    env.art.inks(ctx, 'y_back_full', { x: x - ww / 2, y: y - hh, w: ww, h: hh }, {
      roles: { cream: 'sub', orange: 'me', black: 'panel' }, offset: { black: [4, 5], orange: [-2, 0] }, alpha,
    });
  } else {
    ctx.rrect(x - w * 0.3, y - h * 0.8, w * 0.6, h * 0.7, w * 0.12, { fill: 'sub', alpha });
  }
}

/** The two people still on the pavement: they walk out to the left as the street empties (〔L15〕). */
function pedestrians(ctx, t, k) {
  const leave = easeOut(prog(t, 207.3, 210.3));
  const fade = 1 - prog(t, 209.6, 210.4);
  const list = [[520, 1008, 1.0], [742, 1030, 0.86]];
  list.forEach(([x0, y, s], i) => {
    const x = x0 - 9 * (t - 186.61) - 420 * leave - i * 24 * leave;
    const a = k * fade;
    if (a <= 0.01) return;
    const h = 190 * s, w = h * 0.34;
    dotFill(ctx, { x: x - w, y: y - 8, w: 2 * w, h: 16 }, 'panel', { density: 0.5, cell: 7, alpha: 0.4 * a, vary: (px, py) => clamp(1 - Math.abs(px - x) / w) });
    ctx.at(x + Math.sin(t * 6 + i) * 2, y, () => {
      // a long winter coat, a hat, a scarf, two legs — a silhouette, no face
      ctx.rrect(-w * 0.5, -h * 0.62, w, h * 0.5, w * 0.22, { fill: 'panel', alpha: 0.95 * a });
      ctx.circle(0, -h * 0.73, w * 0.22, { fill: 'panel', alpha: 0.95 * a });
      ctx.rrect(-w * 0.28, -h * 0.8, w * 0.56, h * 0.06, 3, { fill: 'panel', alpha: a });
      ctx.rect(-w * 0.34, -h * 0.62, w * 0.68, h * 0.06, { fill: true, color: 'me', alpha: 0.5 * a });
      ctx.line(-w * 0.18, -h * 0.12, -w * 0.28, 0, { color: 'panel', width: w * 0.2, alpha: a });
      ctx.line(w * 0.18, -h * 0.12, w * 0.28, 0, { color: 'panel', width: w * 0.2, alpha: a });
      if (i === 1) ctx.line(w * 0.5, -h * 0.72, w * 0.9, -h * 1.15, { color: 'panel', width: 3, alpha: a });
    });
    ctx.line(x - w, y, x + w, y, { color: 'ice', alpha: 0.12 * a, width: 1.5 });
  });
}
