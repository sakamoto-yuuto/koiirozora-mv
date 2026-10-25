// THE LINE, part 2: the places of the call, drawn in code in the print language (components/print.js).
// Facts: research/phone1986.md (§1.5 the 1985 booth: brown frame, three glass sides, cold-white tube light;
// §4 the answering machine: cream body, smoked window, two reels, red 用件 LED; §5 mercury lamps, blue-white).
//
//   snow()        falling snow, a pure function of t
//   street()      the night street in three parallax layers (camX = camera truck in px): far roofs, poles and wires,
//                 the mercury lamp with its halftone beam, the snow ground; a near snow bank (foreground) separately
//   bank()        the near snow bank along the bottom edge (foreground, fastest parallax)
//   booth()       the 1985 phone booth, outside view, in booth units (300 x 700)
//   boothInside() the back wall of the booth from inside: tube light beam, the glass side panes with fog and the street
//   fog()         condensation as a fine dot screen; holes (wiped) stay clear
//   fingerText()  characters wiped into the fog by a fingertip (returns the fingertip position)
//   room()        HIS room in the dark: the snow-lit window and its light falling across the desk as halftone
//   homePhone()   his cream push-button home telephone (handset in the cradle; rattle while it rings)
//   machine()     the answering machine (cream body, smoked cassette window, two reels, red 用件 LED, buttons)
import { rand } from '../engine/prng.js';
import { clamp, easeOut, lerp } from '../engine/util.js';
import { segDigits } from './phone.js';
import { dotLight, dotCone, dotFill } from './print.js';

/**
 * Hairline width in virtual 1920x1080 px. The components are placed with ctx.at({ scale }), which would multiply a
 * plain lineWidth; dividing by the current transform's scale keeps every structural line 1.2-2 px on screen.
 */
function lw(ctx, px = 1.5) {
  const m = ctx.g.getTransform();
  const s = (Math.hypot(m.a, m.b) / (ctx.scale || 1)) || 1;
  return Math.max(0.3, px / s);
}

export function snow(ctx, t, { r = { x: 0, y: 0, w: 1920, h: 1080 }, count = 160, seed = 1, wind = 18, speed = 60, size = 3.2, color = 'text', alpha = 0.9, depth = [0.45, 1.6], camX = 0 } = {}) {
  const g = ctx.g;
  g.fillStyle = ctx.col(color, alpha);
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const z = lerp(depth[0], depth[1], rand(seed, i, 1) ** 2), v = speed * z * (0.7 + 0.6 * rand(seed, i, 2));
    const span = r.h + 40, y = ((rand(seed, i, 3) * span + t * v) % span) - 20;
    const lane = rand(seed, i, 4) * (r.w + 200) - 100, W = r.w + 200;
    const x = (((lane + t * wind * z + Math.sin(t * (0.6 + rand(seed, i, 5)) + i) * 14 * z - camX * z * 0.5) % W) + W) % W - 100;
    const s = size * z * (0.6 + 0.6 * rand(seed, i, 6));
    g.moveTo(r.x + x + s, r.y + y); g.arc(r.x + x, r.y + y, s, 0, 6.2832);
  }
  g.fill();
}

/** Night street. camX = camera truck (px, positive = camera moved right); horizon y; lamp 0..1. */
export function street(ctx, t, { camX = 0, horizon = 660, lamp = 1, lampX = 1560, alpha = 1 } = {}) {
  const far = -camX * 0.25, mid = -camX * 0.6;
  // sky: the city glow low on the horizon, as a screen
  dotLight(ctx, 960 + far, horizon, 1300, 'raised', { sy: 0.32, alpha: 0.9, cell: 11, power: 1.3 });
  // far roofs, one row, a few lit windows
  let x = -200 + (far % 160);
  while (x < 2120) {
    const k = Math.round(x - far), w = 110 + 150 * rand(31, k), h = 60 + 110 * rand(37, k), y = horizon - h;
    const gable = rand(39, k) > 0.5, peak = y - 26 * rand(43, k);
    ctx.rect(x, y, w - 4, h + 4, { fill: true, color: 'panel', alpha });
    if (gable) ctx.poly([[x - 6, y], [x + w / 2, peak], [x + w + 2, y]], { fill: true, color: 'panel', alpha, close: true });
    ctx.rect(x, y - 3, w - 4, 5, { fill: true, color: 'sub', alpha: alpha * 0.45 });                    // snow on the eaves
    // hairlines: the roof edge, the gable, the shadow under the eaves and the frame of the lit window
    ctx.line(x, y, x + w - 4, y, { color: 'text', alpha: alpha * 0.3, width: lw(ctx, 1.4) });
    if (gable) ctx.poly([[x - 6, y], [x + w / 2, peak], [x + w + 2, y]], { color: 'text', alpha: alpha * 0.24, width: lw(ctx, 1.3) });
    ctx.line(x, y + 2, x + w - 4, y + 2, { color: 'ice', alpha: alpha * 0.2, width: lw(ctx, 1.2) });
    if (rand(41, k) > 0.45) {
      const wx = x + w * (0.2 + 0.5 * rand(47, k)), wy = y + 20 + 30 * rand(53, k);
      ctx.rect(wx, wy, 14, 11, { fill: true, color: 'sub', alpha: alpha * 0.5 });
      ctx.rect(wx, wy, 14, 11, { color: 'text', alpha: alpha * 0.4, width: lw(ctx, 1.25) });
      ctx.line(wx + 7, wy, wx + 7, wy + 11, { color: 'text', alpha: alpha * 0.28, width: lw(ctx, 1.2) });
    }
    x += w;
  }
  // the snow ground with a soft screen of shade towards the viewer
  ctx.rect(-10, horizon, 1940, 1090 - horizon, { fill: true, color: 'raised', alpha });
  dotFill(ctx, { x: 0, y: horizon, w: 1920, h: 1080 - horizon }, 'panel', { density: 0.5, cell: 9, vary: (px, py) => clamp((py - horizon) / (1080 - horizon)) * 0.8 });
  // poles + sagging wires (mid layer)
  const poles = [-120, 640, 1400, 2160].map((p) => p + mid);
  for (const px of poles) { ctx.rect(px, 150, 16, horizon - 150 + 26, { fill: true, color: 'bg', alpha }); ctx.rect(px - 46, 182, 108, 9, { fill: true, color: 'bg', alpha }); }
  for (let w = 0; w < 3; w++) for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i] - 38 + w * 44, b = poles[i + 1] - 38 + w * 44, pts = [];
    for (let s = 0; s <= 24; s++) { const u = s / 24; pts.push([lerp(a, b, u), 188 + Math.sin(u * Math.PI) * (42 + w * 7) + Math.sin(t * 0.7 + w + i) * 2 * Math.sin(u * Math.PI)]); }
    ctx.poly(pts, { color: 'bg', alpha: alpha * 0.9, width: 2.2 });
  }
  // the mercury lamp: a beam of dots down onto the snow, a pool squashed on the ground
  if (lamp > 0) {
    const lx = lampX + mid;
    ctx.rect(lx - 6, 200, 12, horizon - 200 + 30, { fill: true, color: 'bg', alpha });
    ctx.rect(lx - 6, 200, 60, 10, { fill: true, color: 'bg', alpha });
    dotCone(ctx, [lx + 44, 214], [lx + 44, horizon + 90], 260, 'ice', { alpha: 0.55 * lamp, cell: 10 });
    dotLight(ctx, lx + 44, horizon + 90, 330, 'ice', { sy: 0.22, alpha: 0.8 * lamp, cell: 10 });
    ctx.glow('ice', 30, () => ctx.rect(lx + 26, 208, 38, 9, { fill: true, color: 'text', alpha: lamp }), lamp);
  }
}

/** The near snow bank across the bottom (foreground). */
export function bank(ctx, t, { camX = 0, y = 1000, alpha = 1 } = {}) {
  const near = -camX * 1.4, pts = [[-40, 1100]];
  for (let x = -40; x <= 1960; x += 40) pts.push([x, y + 26 * Math.sin((x - near) * 0.004) + 14 * Math.sin((x - near) * 0.011 + 1)]);
  pts.push([1960, 1100]);
  ctx.at(10, -8, () => ctx.poly(pts, { fill: true, color: 'bg', alpha: alpha * 0.8, close: true }));     // shadow plate
  ctx.poly(pts, { fill: true, color: 'raised', alpha, close: true });
  dotFill(ctx, { x: 0, y: y - 50, w: 1920, h: 1130 - y }, 'sub', { pts, density: 0.4, cell: 9, alpha, vary: (px, py) => 1 - clamp((py - y + 30) / 90) });
}

/** The 1985 booth, outside, in booth units (W 300 x H 700). lit 0..1; fogK; inside() draws behind the glass. */
export function booth(ctx, { lit = 0, fogK = 0, alpha = 1, inside = null, snowRoof = 1, spill = true } = {}) {
  const fr = { fill: true, color: 'booth', alpha };
  if (lit > 0 && spill) dotLight(ctx, 150, 700, 520, 'ice', { sy: 0.26, alpha: 0.85 * lit, cell: 10 });
  const gl = { x: 18, y: 70, w: 264, h: 560 };
  ctx.clip(gl, () => {
    ctx.rect(gl.x, gl.y, gl.w, gl.h, { fill: true, color: 'bg', alpha });
    if (lit > 0) { ctx.rect(gl.x, gl.y, gl.w, gl.h, { fill: true, color: 'ice', alpha: alpha * 0.22 * lit }); dotCone(ctx, [150, 86], [150, 640], 170, 'ice', { alpha: 0.9 * lit, cell: 8, w0: 100 }); }
    if (inside) inside();
    if (fogK > 0) fog(ctx, gl, { k: fogK, alpha, cell: 6 });
  });
  ctx.at(8, 8, () => { ctx.rect(0, 70, 18, 630, { fill: true, color: 'bg', alpha: alpha * 0.7 }); ctx.rect(282, 70, 18, 630, { fill: true, color: 'bg', alpha: alpha * 0.7 }); });
  ctx.rect(-14, 34, 328, 40, fr);
  ctx.rect(-6, 20, 312, 18, { fill: true, color: 'booth', alpha: alpha * 0.8 });
  if (snowRoof > 0) ctx.rrect(-20, 4, 340, 26 * snowRoof, 13, { fill: 'text', alpha: alpha * 0.92 });
  ctx.rect(0, 70, 18, 630, fr); ctx.rect(282, 70, 18, 630, fr);
  ctx.rect(0, 630, 300, 70, fr);
  ctx.rect(18, 330, 264, 7, { fill: true, color: 'booth', alpha: alpha * 0.85 });
  ctx.rect(148, 70, 5, 560, { fill: true, color: 'booth', alpha: alpha * 0.85 });
  ctx.rect(40, 74, 220, 12, { fill: true, color: lit > 0.5 ? 'text' : 'line', alpha });
  ctx.rect(100, 40, 100, 24, { fill: true, color: 'text', alpha: alpha * (0.45 + 0.55 * lit) });
  ctx.text('電話', 150, 59, { size: 18, font: 'sans', weight: 900, color: 'booth', align: 'center', alpha });
  // hairlines: the inner edges of the posts, the two glass mullions, the roof slab and the sign box
  ctx.line(18, 70, 18, 700, { color: 'ice', alpha: alpha * 0.3, width: lw(ctx, 1.4) });
  ctx.line(282, 70, 282, 700, { color: 'ice', alpha: alpha * 0.3, width: lw(ctx, 1.4) });
  ctx.line(0, 70, 300, 70, { color: 'text', alpha: alpha * 0.26, width: lw(ctx, 1.3) });
  ctx.line(18, 630, 282, 630, { color: 'text', alpha: alpha * 0.24, width: lw(ctx, 1.3) });
  ctx.line(150.5, 70, 150.5, 630, { color: 'text', alpha: alpha * 0.26, width: lw(ctx, 1.3) });
  ctx.line(18, 333.5, 282, 333.5, { color: 'text', alpha: alpha * 0.26, width: lw(ctx, 1.3) });
  ctx.line(-14, 34, 314, 34, { color: 'text', alpha: alpha * 0.32, width: lw(ctx, 1.5) });
  ctx.line(-14, 74, 314, 74, { color: 'ice', alpha: alpha * 0.22, width: lw(ctx, 1.3) });
  ctx.line(-20, 30, 320, 30, { color: 'ice', alpha: alpha * 0.2, width: lw(ctx, 1.2) });
  ctx.rect(100, 40, 100, 24, { color: 'line', alpha: alpha * 0.45, width: lw(ctx, 1.3) });
}

/** The booth seen from inside, behind her: back wall, tube light, side glass with the street, fog. */
export function boothInside(ctx, t, { lit = 1, fogK = 0.5, alpha = 1, camX = 0 } = {}) {
  // side panes: the street at night, far and dark, a lamp blur, snow
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel', alpha });
  dotLight(ctx, 260 - camX * 0.3, 380, 420, 'ice', { alpha: 0.5, cell: 14 });
  dotLight(ctx, 1700 - camX * 0.3, 300, 360, 'ice', { alpha: 0.4, cell: 14 });
  snow(ctx, t, { count: 80, seed: 17, size: 3, alpha: 0.4, speed: 40, camX });
  // back wall panel (between the mullions)
  ctx.rect(330, 0, 1260, 1080, { fill: true, color: 'raised', alpha });
  dotCone(ctx, [960, -20], [960, 1080], 760, 'ice', { alpha: 0.7 * lit, cell: 12, w0: 420 });
  // mullions + the shelf of the directory
  for (const x of [300, 1590]) { ctx.rect(x + 10, 0, 40, 1080, { fill: true, color: 'bg', alpha: alpha * 0.6 }); ctx.rect(x, 0, 40, 1080, { fill: true, color: 'booth', alpha }); }
  // hairlines on both edges of each mullion, and the seam where the back wall meets them
  for (const x of [300, 340, 1590, 1630]) ctx.line(x, 0, x, 1080, { color: 'ice', alpha: alpha * 0.26, width: lw(ctx, 1.3) });
  // the directory shelf on the back wall, and a directory hanging from a chain
  const shelf = { x: 388, y: 536, w: 206, h: 9 };
  ctx.rect(shelf.x, shelf.y, shelf.w, shelf.h, { fill: true, color: 'booth', alpha });
  ctx.line(shelf.x, shelf.y, shelf.x + shelf.w, shelf.y, { color: 'ice', alpha: alpha * 0.5, width: lw(ctx, 1.5) });
  ctx.line(shelf.x + 14, shelf.y + shelf.h, shelf.x + 40, shelf.y + 52, { color: 'ice', alpha: alpha * 0.34, width: lw(ctx, 1.2) });
  ctx.line(shelf.x + shelf.w - 14, shelf.y + shelf.h, shelf.x + shelf.w - 40, shelf.y + 52, { color: 'ice', alpha: alpha * 0.34, width: lw(ctx, 1.2) });
  // directories standing at the right end of the shelf
  for (let i = 0; i < 3; i++) {
    const bx = shelf.x + shelf.w - 70 + i * 19, bh = 38 - (i % 2) * 7;
    ctx.rect(bx, shelf.y - bh, 14, bh, { fill: true, color: i % 2 ? 'raised' : 'panel', alpha: alpha * 0.95 });
    ctx.rect(bx, shelf.y - bh, 14, bh, { color: 'text', alpha: alpha * 0.4, width: lw(ctx, 1.2) });
    ctx.line(bx + 4, shelf.y - bh + 9, bx + 10, shelf.y - bh + 9, { color: 'ice', alpha: alpha * 0.3, width: lw(ctx, 1.2) });
  }
  const chainX = shelf.x + 92;
  ctx.circle(chainX, 296, 4, { fill: true, color: 'ice', alpha: alpha * 0.5 });
  ctx.line(chainX, 300, chainX, 406, { color: 'ice', alpha: alpha * 0.48, width: lw(ctx, 1.3) });
  for (let i = 0; i < 9; i++) {
    const y = 304 + i * 11;
    ctx.line(chainX - 2.5, y, chainX + 2.5, y + 6, { color: 'ice', alpha: alpha * 0.36, width: lw(ctx, 1.2) });
  }
  const book = { x: chainX - 34, y: 406, w: 68, h: 120 };
  ctx.rect(book.x, book.y, book.w, book.h, { fill: true, color: 'panel', alpha: alpha * 0.9 });
  ctx.rect(book.x, book.y, book.w, book.h, { color: 'text', alpha: alpha * 0.48, width: lw(ctx, 1.4) });
  ctx.line(book.x + 7, book.y + 2, book.x + 7, book.y + book.h - 2, { color: 'text', alpha: alpha * 0.32, width: lw(ctx, 1.2) });
  for (let i = 0; i < 3; i++) ctx.line(book.x + book.w + 2, book.y + 6 + i * 3, book.x + book.w + 2, book.y + book.h - 6 - i * 3, { color: 'ice', alpha: alpha * 0.28, width: lw(ctx, 1.2) });
  ctx.line(book.x + 14, book.y + 22, book.x + book.w - 14, book.y + 22, { color: 'text', alpha: alpha * 0.38, width: lw(ctx, 1.2) });
  ctx.line(book.x + 14, book.y + 34, book.x + book.w - 20, book.y + 34, { color: 'text', alpha: alpha * 0.3, width: lw(ctx, 1.2) });
  fog(ctx, { x: 0, y: 0, w: 300, h: 1080 }, { k: fogK, cell: 7, seed: 31 });
  fog(ctx, { x: 1630, y: 0, w: 290, h: 1080 }, { k: fogK, cell: 7, seed: 37 });
}

/** Condensation as a fine dot screen with a few larger droplets. holes = [{x, y, r}] stay clear. */
export function fog(ctx, r, { k = 1, alpha = 1, holes = [], seed = 3, color = 'text', cell = 7 } = {}) {
  if (k <= 0) return;
  const g = ctx.g;
  g.save();
  if (holes.length) {
    g.beginPath(); g.rect(r.x, r.y, r.w, r.h);
    for (const h of holes) { g.moveTo(h.x + h.r, h.y); g.arc(h.x, h.y, h.r, 0, 6.2832, true); }
    g.clip('evenodd');
  }
  dotFill(ctx, r, color, { density: 0.32 * k, cell, alpha: alpha * 0.55, vary: (px, py) => 0.6 + 0.6 * ((py - r.y) / r.h) + 0.25 * Math.sin(px * 0.013 + py * 0.007 + seed) });
  g.fillStyle = ctx.col(color, alpha * 0.45 * k);
  g.beginPath();
  const n = Math.round((r.w * r.h) / 2600 * k);
  for (let i = 0; i < n; i++) {
    const x = r.x + rand(seed, i, 1) * r.w, y = r.y + Math.sqrt(rand(seed, i, 2)) * r.h, s = 1.5 + 3 * rand(seed, i, 3);
    g.moveTo(x + s, y); g.arc(x, y, s, 0, 6.2832);
  }
  g.fill();
  g.restore(); ctx._font = '';
}

/**
 * Characters wiped into fog: reveal in reading order (k 0..1). The letters are drawn with `draw(ch, x, y, size)`
 * (so a caller can print them as windows); returns the fingertip [x, y] at the front of the stroke (or null).
 */
export function fingerText(ctx, str, x, y, { size = 140, k = 1, color = 'bg', alpha = 1, gap = 0.08, font = 'hand', drips = true, t = 0 } = {}) {
  const chars = [...str], per = 1 / chars.length;
  let cx = x, tip = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], w = ctx.measure(ch, { size, font, weight: 600 });
    const kk = clamp((k - i * per) / (per * (1 - gap)));
    if (kk > 0) {
      const hh = size * 1.25 * easeOut(kk);
      ctx.clip({ x: cx - 10, y: y - size, w: w + 20, h: hh }, () => ctx.text(ch, cx, y, { size, font, weight: 600, color, alpha }));
      if (kk < 1) tip = [cx + w * (0.3 + 0.4 * Math.sin(kk * 19)), y - size + hh];
      if (drips && kk >= 1) for (let d = 0; d < 2; d++) {
        const dx = cx + w * (0.25 + 0.5 * rand(77, i, d)), len = (30 + 60 * rand(78, i, d)) * clamp((k - (i + 1) * per) * 6);
        ctx.line(dx, y + 8, dx, y + 8 + len, { color, alpha: alpha * 0.6, width: 4 });
      }
    }
    cx += w + size * 0.06;
  }
  return tip;
}

/** HIS room, dark. The window's snow light falls across the desk and floor as a halftone parallelogram. */
export function room(ctx, t, { alpha = 1, win = { x: 1180, y: 110, w: 520, h: 560 }, desk = 780, camX = 0 } = {}) {
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel', alpha });
  const wx = win.x - camX * 0.4;
  ctx.clip({ ...win, x: wx }, () => {
    ctx.rect(wx, win.y, win.w, win.h, { fill: true, color: 'raised', alpha });
    dotLight(ctx, wx + win.w / 2, win.y + win.h * 0.2, win.w, 'ice', { alpha: 0.6, cell: 11 });
    snow(ctx, t, { r: { ...win, x: wx }, count: 70, seed: 21, size: 2.8, alpha: 0.75 * alpha, speed: 45 });
  });
  ctx.rect(wx + win.w / 2 - 5, win.y, 10, win.h, { fill: true, color: 'panel', alpha });
  ctx.rect(wx, win.y + win.h * 0.45, win.w, 10, { fill: true, color: 'panel', alpha });
  // hairlines: the window casing, the inner sash, a highlight on each mullion and the sill
  ctx.rect(wx, win.y, win.w, win.h, { color: 'ice', alpha: alpha * 0.3, width: lw(ctx, 1.6) });
  ctx.rect(wx + 12, win.y + 12, win.w - 24, win.h - 24, { color: 'text', alpha: alpha * 0.2, width: lw(ctx, 1.2) });
  ctx.line(wx + win.w / 2, win.y + 2, wx + win.w / 2, win.y + win.h - 2, { color: 'ice', alpha: alpha * 0.26, width: lw(ctx, 1.2) });
  ctx.line(wx + 2, win.y + win.h * 0.45 + 5, wx + win.w - 2, win.y + win.h * 0.45 + 5, { color: 'ice', alpha: alpha * 0.26, width: lw(ctx, 1.2) });
  ctx.line(wx - 24, win.y + win.h, wx + win.w + 22, win.y + win.h, { color: 'ice', alpha: alpha * 0.38, width: lw(ctx, 1.8) });
  ctx.rect(wx - 90, win.y - 40, 110, win.h + 80, { fill: true, color: 'bg', alpha });                    // curtain
  for (let i = 0; i < 4; i++) {                                                                         // the folds at its edge
    const x0 = wx - 80 + i * 24, fold = [];
    for (let yy = win.y - 36; yy <= win.y + win.h + 36; yy += 26) fold.push([x0 + 3.5 * Math.sin((yy - win.y) * 0.018 + i * 1.9), yy]);
    ctx.poly(fold, { color: 'text', alpha: alpha * (0.2 + 0.03 * i), width: lw(ctx, 1.2) });
  }
  // the light through the window onto the desk / floor: a slanted parallelogram of dots
  const pts = [[wx + 20, desk], [wx + win.w - 20, desk], [wx + win.w - 420, 1080], [wx - 520, 1080]];
  dotFill(ctx, { x: wx - 540, y: desk, w: win.w + 560, h: 1080 - desk }, 'ice', { pts, density: 0.16, cell: 10, alpha: 0.85 });
  ctx.rect(0, desk, 1920, 1080 - desk, { fill: true, color: 'bg', alpha: alpha * 0.55 });
  dotFill(ctx, { x: wx - 540, y: desk, w: win.w + 560, h: 1080 - desk }, 'ice', { pts, density: 0.12, cell: 10, alpha: 0.9 });
  ctx.rect(0, desk, 1920, 5, { fill: true, color: 'line', alpha });
  ctx.line(0, desk + 1, 1920, desk + 1, { color: 'ice', alpha: alpha * 0.3, width: lw(ctx, 1.5) });
  ctx.line(0, desk + 6, 1920, desk + 6, { color: 'text', alpha: alpha * 0.18, width: lw(ctx, 1.2) });
}

/** His home telephone, cream push-button, in its own units (W 360 x H 220); rattle = px of shake (ringing). */
export function homePhone(ctx, { rattle = 0, alpha = 1, t = 0 } = {}) {
  ctx.at(8, 10, () => ctx.rrect(0, 70, 360, 150, 28, { fill: 'bg', alpha: alpha * 0.7 }));             // shadow plate
  ctx.rrect(0, 70, 360, 150, 28, { fill: 'sub', alpha });                                             // body
  ctx.rrect(5, 75, 350, 140, 24, { fill: null, stroke: 'ice', strokeAlpha: 0.2, width: lw(ctx, 1.3) }); // bevel
  ctx.rrect(110, 104, 140, 96, 10, { fill: 'raised', alpha });                                        // keypad well
  ctx.rrect(110, 104, 140, 96, 10, { fill: null, stroke: 'line', strokeAlpha: 0.3, width: lw(ctx, 1.3) });
  for (let i = 0; i < 12; i++) {
    const x = 120 + (i % 3) * 44, y = 110 + Math.floor(i / 3) * 22;
    ctx.rrect(x, y, 36, 16, 4, { fill: 'text', alpha: alpha * 0.85 });
    ctx.rrect(x, y, 36, 16, 4, { fill: null, stroke: 'line', strokeAlpha: 0.35, width: lw(ctx, 1.2) });
  }
  ctx.line(20, 208, 340, 208, { color: 'line', alpha: alpha * 0.22, width: lw(ctx, 1.2) });            // front seam
  const j = rattle ? Math.sin(t * 95) * rattle : 0;
  ctx.at(j, -Math.abs(j) * 0.6, () => {                                                                 // the handset on the cradle
    ctx.at(6, 8, () => ctx.rrect(10, 18, 340, 56, 26, { fill: 'bg', alpha: alpha * 0.6 }));
    ctx.rrect(10, 18, 340, 56, 26, { fill: 'text', alpha });
    ctx.rrect(0, 6, 92, 70, 30, { fill: 'text', alpha }); ctx.rrect(268, 6, 92, 70, 30, { fill: 'text', alpha });
    ctx.rrect(40, 26, 280, 8, 4, { fill: 'sub', alpha: alpha * 0.5 });
  }, { rot: j * 0.004 });
}

/**
 * The answering machine, in machine units (W 760 x H 290).
 *   reel = rotation (rad), rec 0..1, count = 用件 number (null = dark), blink 0..1, counter = tape counter, press = button.
 */
export function machine(ctx, { reel = 0, rec = 0, count = null, blink = 1, counter = 0, press = null, alpha = 1 } = {}) {
  ctx.at(12, 14, () => ctx.rrect(0, 0, 760, 290, 24, { fill: 'bg', alpha: alpha * 0.7 }));
  ctx.rrect(0, 0, 760, 290, 24, { fill: 'sub', alpha });
  dotFill(ctx, { x: 0, y: 170, w: 760, h: 120 }, 'line', { density: 0.18, cell: 7, alpha, pts: [[24, 170], [736, 170], [760, 266], [736, 290], [24, 290], [0, 266]] });
  // hairlines: the body bevel, the panel seams and the rims of the window, display and counter
  ctx.rrect(6, 6, 748, 278, 20, { fill: null, stroke: 'ice', strokeAlpha: 0.2, width: lw(ctx, 1.4) });
  ctx.line(458, 28, 458, 258, { color: 'line', alpha: alpha * 0.28, width: lw(ctx, 1.2) });
  ctx.line(24, 258, 736, 258, { color: 'line', alpha: alpha * 0.22, width: lw(ctx, 1.2) });
  ctx.rrect(40, 40, 400, 170, 14, { fill: 'panel', alpha });
  ctx.rrect(40, 40, 400, 170, 14, { fill: null, stroke: 'text', strokeAlpha: 0.26, width: lw(ctx, 1.4) });
  for (const cx of [150, 330]) {
    ctx.circle(cx, 125, 56, { fill: true, color: 'raised', alpha });
    ctx.circle(cx, 125, 20, { fill: true, color: 'sub', alpha });
    ctx.at(cx, 125, () => {
      for (let s = 0; s < 6; s++) { const a = s * Math.PI / 3; ctx.line(Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 19, Math.sin(a) * 19, { color: 'panel', alpha, width: 4 }); }
    }, { rot: reel });
  }
  ctx.line(150, 181, 330, 181, { color: 'youDim', alpha: alpha * 0.8, width: 3 });
  ctx.text('MICRO CASSETTE', 240, 202, { size: 13, font: 'mono', color: 'mute', align: 'center', alpha });
  ctx.rrect(476, 40, 120, 100, 10, { fill: 'panel', alpha });
  ctx.rrect(476, 40, 120, 100, 10, { fill: null, stroke: 'text', strokeAlpha: 0.26, width: lw(ctx, 1.3) });
  segDigits(ctx, count == null ? '' : count, 500, 56, 64, { n: 2, color: 'err', alpha: alpha * (count == null ? 0 : blink), ghost: count == null ? 0.05 : 0.12 });
  ctx.text('用件', 536, 162, { size: 16, font: 'sans', weight: 700, color: 'panel', align: 'center', alpha });
  ctx.circle(650, 64, 12, { fill: true, color: rec > 0.05 ? 'err' : 'errDim', alpha: alpha * (0.4 + 0.6 * rec) });
  if (rec > 0.05) ctx.glow('err', 26, () => ctx.circle(650, 64, 10, { fill: true, color: 'err', alpha: alpha * rec }), alpha * rec);
  ctx.text('録音', 650, 100, { size: 14, font: 'sans', weight: 700, color: 'panel', align: 'center', alpha });
  ctx.rrect(616, 116, 110, 34, 6, { fill: 'panel', alpha });
  ctx.rrect(616, 116, 110, 34, 6, { fill: null, stroke: 'text', strokeAlpha: 0.24, width: lw(ctx, 1.2) });
  ctx.text(String(Math.floor(counter) % 1000).padStart(3, '0'), 671, 141, { size: 24, font: 'mono', color: 'text', align: 'center', alpha });
  ['留守', '再生', '停止', '消去'].forEach((l, i) => {
    const x = 476 + i * 66, p = press === l ? 1 : 0;
    ctx.rrect(x, 200, 58, 50, 8, { fill: 'panel', alpha: alpha * 0.8 });
    ctx.rrect(x, 196 + p * 4, 58, 50, 8, { fill: l === '再生' ? 'text' : 'raised', alpha });
    ctx.rrect(x, 196 + p * 4, 58, 50, 8, { fill: null, stroke: 'text', strokeAlpha: 0.26, width: lw(ctx, 1.2) });
    ctx.text(l, x + 29, 228 + p * 4, { size: 16, font: 'sans', weight: 700, color: 'panel', align: 'center', alpha });
  });
}
