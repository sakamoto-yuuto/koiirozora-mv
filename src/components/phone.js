// THE LINE, part 1: the green public telephone (NTT MC-3P, 1986) and what it shows, drawn in code.
// Facts: research/phone1986.md (green body ~#2E6B55 = palette role `phone`; 3-digit red 7-segment LED showing UNITS
// (度数), not yen; card slot = eject slot; receiver on the left, 3x4 keypad in the middle, card / coin on the right).
//
//   segDigits()   7-segment digits; unlit segments faintly visible behind a dark red window
//   mc3p()        the phone, front view; geometry in its own units (W 460 x H 740), placed with ctx.at()
//   card()        a telephone card (54 x 85.6 mm), with its punched unit scale
//   tone()        a telephone tone as a waveform: 'dial' 400 Hz steady / 'ring' 400 Hz AM 16 Hz, 1 s on 2 s off /
//                 'busy' 400 Hz 0.5 / 0.5 / 'dtmf' two frequencies of a key / 'beep' 1 kHz
//   cord()        the coiled cord between two points (a helix seen from the side)
// Pure functions of their arguments.
import { clamp, easeOut, lerp } from '../engine/util.js';
import { dotFill } from './print.js';

export const PHONE = { W: 460, H: 740 };

/** Hairline width in virtual px, divided by the caller's ctx.at scale so it stays 1.2-2 px (see world.js). */
function lw(ctx, px = 1.5) {
  const m = ctx.g.getTransform();
  const s = (Math.hypot(m.a, m.b) / (ctx.scale || 1)) || 1;
  return Math.max(0.3, px / s);
}

// segments a..g as polylines in a 1 x 2 cell (x right, y down), slanted 8 degrees
const SEG = {
  a: [[0.14, 0.05], [0.86, 0.05]], b: [[0.92, 0.12], [0.88, 0.92]], c: [[0.87, 1.08], [0.83, 1.88]],
  d: [[0.12, 1.95], [0.78, 1.95]], e: [[0.11, 1.08], [0.07, 1.88]], f: [[0.16, 0.12], [0.12, 0.92]], g: [[0.16, 1.0], [0.84, 1.0]],
};
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };

/** str right-aligned in `n` cells at (x, y) = top-left, cell height h. color = lit role; ghost = unlit alpha. */
export function segDigits(ctx, str, x, y, h, { n = 3, color = 'err', alpha = 1, ghost = 0.12, width = null, glow = 14 } = {}) {
  const w = h * 0.52, gap = h * 0.16, lw = width ?? h * 0.13, s = String(str).padStart(n, ' ').slice(-n);
  const draw = (lit) => {
    for (let i = 0; i < n; i++) {
      const on = DIGIT[s[i]] ?? '', x0 = x + i * (w + gap);
      for (const k of 'abcdefg') {
        const isOn = on.includes(k);
        if (isOn !== lit) continue;
        const [[ax, ay], [bx, by]] = SEG[k];
        ctx.line(x0 + ax * w, y + ay * h / 2, x0 + bx * w, y + by * h / 2, { color, alpha: alpha * (lit ? 1 : ghost), width: lw });
      }
    }
  };
  draw(false);
  if (glow > 0) ctx.glow(color, glow, () => draw(true), alpha); else draw(true);
  return n * (w + gap) - gap;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
/** Key centre in phone units. */
export const keyAt = (k) => { const i = KEYS.indexOf(String(k)); return { x: 205 + (i % 3) * 66, y: 330 + Math.floor(i / 3) * 62 }; };

/**
 * The MC-3P, front view, in phone units (0..460 x 0..740); place it with ctx.at(x, y, () => mc3p(...), { scale }).
 *   offHook 0..1 (receiver lifted out of the cradle), units (null = LED dark), card 0..1 (inserted), press {key, k}
 *   (k = 0..1 depression), lamp = 0..1 glow of the LED window.
 */
export function mc3p(ctx, { offHook = 0, units = null, card: cardIn = 0, press = null, ejected = 0, alpha = 1 } = {}) {
  const o = { alpha };
  // body: a rounded slab with a bevel and one hairline highlight
  ctx.at(14, 16, () => ctx.rrect(0, 0, 450, 718, 30, { fill: 'bg', alpha: alpha * 0.75 }));      // shadow plate, out of register
  ctx.rrect(0, 0, 450, 718, 30, { fill: 'phone', alpha });
  dotFill(ctx, { x: 300, y: 0, w: 150, h: 718 }, 'bg', { density: 0.22, cell: 8, alpha, pts: [[330, 0], [420, 0], [450, 30], [450, 688], [420, 718], [300, 718]] });
  ctx.rrect(10, 10, 430, 698, 24, { fill: null, stroke: 'text', strokeAlpha: 0.2, width: lw(ctx, 1.6) });
  ctx.line(16, 52, 16, 620, { color: 'ice', alpha: alpha * 0.2, width: lw(ctx, 1.4) });                 // bevel highlight
  // cradle (left): a recess the receiver lies in
  ctx.rrect(26, 70, 128, 540, 26, { fill: 'panel', alpha: alpha * 0.55 });
  ctx.rrect(26, 70, 128, 540, 26, { fill: null, stroke: 'ice', strokeAlpha: 0.2, width: lw(ctx, 1.3) });
  ctx.rrect(42, 300, 96, 26, 8, { fill: 'raised', alpha: alpha * 0.9 });                   // hook switch
  // LED window above the keypad
  ctx.rrect(178, 150, 196, 96, 10, { fill: 'panel', alpha });
  ctx.rrect(186, 158, 180, 80, 6, { fill: 'errDim', alpha: alpha * 0.35 });
  segDigits(ctx, units == null ? '   ' : units, 206, 170, 56, { color: 'err', alpha: alpha * (units == null ? 0 : 1), ghost: units == null ? 0 : 0.14 });
  if (units == null) segDigits(ctx, '888', 206, 170, 56, { color: 'err', alpha: alpha * 0.06, ghost: 0, glow: 0 });
  ctx.text('度数', 276, 268, { size: 15, font: 'sans', color: 'sub', align: 'center', alpha: alpha * 0.8 });
  // keypad 3 x 4
  ctx.rrect(172, 292, 208, 262, 14, { fill: 'panel', alpha: alpha * 0.7 });
  ctx.rrect(172, 292, 208, 262, 14, { fill: null, stroke: 'ice', strokeAlpha: 0.3, width: lw(ctx, 1.5) });
  for (const k of KEYS) {
    const { x, y } = keyAt(k), p = press && press.key === k ? clamp(press.k) : 0;
    ctx.rrect(x - 27, y - 24 + 3, 54, 48, 9, { fill: 'panel', alpha });
    ctx.rrect(x - 27, y - 24 + p * 3, 54, 46, 9, { fill: p > 0.05 ? 'sub' : 'text', alpha: alpha * (0.9 - 0.15 * p) });
    ctx.text(k, x, y + 9 + p * 3, { size: 24, font: 'mono', weight: 700, color: 'panel', align: 'center', alpha });
  }
  // card slot (right, top) + coin slot + coin return
  ctx.rrect(394, 150, 40, 150, 8, { fill: 'panel', alpha });
  ctx.rrect(394, 150, 40, 150, 8, { fill: null, stroke: 'ice', strokeAlpha: 0.3, width: lw(ctx, 1.4) });
  ctx.rrect(408, 160, 12, 130, 4, { fill: 'bg', alpha });
  ctx.text('カード', 414, 322, { size: 13, font: 'sans', color: 'sub', align: 'center', alpha: alpha * 0.8 });
  ctx.rrect(394, 350, 40, 90, 8, { fill: 'panel', alpha });
  ctx.rrect(394, 350, 40, 90, 8, { fill: null, stroke: 'ice', strokeAlpha: 0.28, width: lw(ctx, 1.3) });
  ctx.rrect(410, 360, 8, 70, 3, { fill: 'bg', alpha });
  ctx.text('10 100', 414, 462, { size: 12, font: 'mono', color: 'sub', align: 'center', alpha: alpha * 0.8 });
  ctx.rrect(380, 600, 58, 70, 10, { fill: 'panel', alpha });
  ctx.rrect(380, 600, 58, 70, 10, { fill: null, stroke: 'ice', strokeAlpha: 0.26, width: lw(ctx, 1.3) });
  ctx.rrect(392, 612, 34, 22, 4, { fill: 'bg', alpha });
  // instruction plate
  ctx.rrect(172, 590, 196, 82, 6, { fill: 'text', alpha: alpha * 0.86 });
  for (let i = 0; i < 4; i++) ctx.line(186, 610 + i * 16, 186 + [150, 120, 160, 90][i], 610 + i * 16, { color: 'err', alpha: alpha * 0.55, width: 4 });
  ctx.rrect(172, 590, 196, 82, 6, { fill: null, stroke: 'line', strokeAlpha: 0.35, width: lw(ctx, 1.3) });
  for (let i = 0; i < 4; i++) {                                                                    // the small print under each line
    const y = 610 + i * 16;
    ctx.line(186, y + 5, 186 + [150, 120, 160, 90][i] * 0.78, y + 5, { color: 'line', alpha: alpha * 0.32, width: lw(ctx, 1.2) });
  }
  ctx.line(186, 666, 330, 666, { color: 'line', alpha: alpha * 0.3, width: lw(ctx, 1.2) });
  // the card in the slot: a sliver sticking out, sliding in
  if (cardIn > 0 || ejected > 0) {
    const out = cardIn > 0 ? lerp(120, 26, easeOut(clamp(cardIn))) : lerp(26, 120, easeOut(clamp(ejected)));
    ctx.clip({ x: 380, y: 150 - out - 2, w: 70, h: out + 2 }, () => ctx.at(394, 150 - out, () => cardEdge(ctx, alpha)));
  }
  // the receiver in its cradle (lifts out to the left / up)
  const lift = easeOut(clamp(offHook));
  if (lift < 0.999) ctx.at(30 - lift * 240, 80 - lift * 60, () => handset(ctx, { alpha: alpha * (1 - lift * 0.0) }), { rot: -lift * 0.5 });
}

/** The protruding end of a card as seen from the front (in slot units). */
function cardEdge(ctx, alpha) {
  ctx.rrect(4, 0, 32, 200, 4, { fill: 'text', alpha });
  ctx.rrect(4, 0, 32, 200, 4, { fill: null, stroke: 'line', width: 1.5, alpha });
  ctx.rect(10, 6, 20, 14, { fill: true, color: 'me', alpha: alpha * 0.8 });
}

/** The handset (receiver), vertical, in its own units (120 x 520). */
export function handset(ctx, { alpha = 1, color = 'phone' } = {}) {
  ctx.rrect(14, 0, 96, 120, 40, { fill: color, alpha });                 // earpiece
  ctx.rrect(34, 80, 56, 360, 24, { fill: color, alpha });                // grip
  ctx.rrect(14, 400, 96, 120, 40, { fill: color, alpha });               // mouthpiece
  ctx.rrect(40, 90, 10, 340, 5, { fill: 'text', alpha: alpha * 0.14 });  // highlight
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.circle(44 + i * 18, 28 + j * 18, 4, { fill: true, color: 'panel', alpha: alpha * 0.7 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.circle(44 + i * 18, 450 + j * 18, 4, { fill: true, color: 'panel', alpha: alpha * 0.7 });
}

/** A telephone card, landscape, in mm-ish units x 4 (342 x 216). units = how many are left (punch marks). */
export function card(ctx, { alpha = 1, units = 50, of = 50 } = {}) {
  ctx.rrect(0, 0, 342, 216, 12, { fill: 'text', alpha });
  ctx.rrect(0, 0, 342, 216, 12, { fill: null, stroke: 'line', width: 2, alpha });
  // picture side: a small printed snowscape in two inks (cards of 1986 carry pictures)
  ctx.rect(18, 18, 306, 132, { fill: true, color: 'ice', alpha: alpha * 0.85 });
  ctx.poly([[18, 150], [90, 96], [150, 128], [214, 84], [324, 150]], { fill: true, color: 'sub', alpha, close: true });
  ctx.text('テレホンカード', 24, 182, { size: 18, font: 'sans', weight: 700, color: 'panel', alpha });
  ctx.text(`${of}`, 290, 186, { size: 26, font: 'mono', weight: 700, color: 'err', alpha, align: 'right' });
  ctx.text('度数', 296, 186, { size: 13, font: 'sans', color: 'panel', alpha });
  // punched scale along the bottom edge: one hole per 10 units used
  for (let i = 0; i < 5; i++) {
    const used = (of - units) / of > (i + 0.5) / 5;
    ctx.circle(40 + i * 60, 202, 5, { fill: used, color: 'panel', alpha, width: 1.5 });
  }
}

/**
 * A telephone tone drawn as a scope trace in rect r at song time t (te = seconds since the tone started).
 *   kind 'dial' | 'ring' | 'busy' | 'dtmf' | 'beep' ; key for dtmf. The trace scrolls; gated tones go flat when off.
 *   span = seconds of signal across the rect (the wave is drawn at a readable 'slow' frequency, its SHAPE true).
 */
const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], '*': [941, 1209], 0: [941, 1336], '#': [941, 1477] };
export function tone(ctx, r, te, { kind = 'dial', key = '0', color = 'ice', alpha = 1, width = 3, span = 3, amp = 0.38, n = 360 } = {}) {
  const pts = [];
  const gate = (s) => (kind === 'ring' ? (s % 3 < 1 ? 1 : 0) : kind === 'busy' ? (s % 1 < 0.5 ? 1 : 0) : kind === 'beep' ? (s >= 0 && s < 0.45 ? 1 : 0) : 1);
  for (let i = 0; i <= n; i++) {
    const u = i / n, s = te - span + u * span;                  // signal time at this x (right edge = now)
    let v = 0;
    if (s >= 0 && gate(s)) {
      const vis = 40 / span;                                    // visible carrier cycles: 'slowed' 400 Hz
      if (kind === 'dtmf') { const [f1, f2] = DTMF[key] ?? DTMF[0]; v = 0.5 * Math.sin(u * vis * 6.283 * f1 / 400) + 0.5 * Math.sin(u * vis * 6.283 * f2 / 400); }
      else if (kind === 'beep') v = Math.sin(u * vis * 2.5 * 6.283);
      else v = Math.sin(u * vis * 6.283) * (kind === 'ring' ? 0.7 + 0.3 * Math.sin(s * 6.283 * 16) : 1);
    }
    pts.push([r.x + u * r.w, r.y + r.h / 2 - v * amp * r.h]);
  }
  ctx.glow(color, 10, () => ctx.poly(pts, { color, alpha, width }), alpha * 0.8);
}

/** Coiled cord from (x0, y0) to (x1, y1): loops = number of coils, r = coil radius, sag = droop in px. */
export function cord(ctx, x0, y0, x1, y1, { loops = 26, r = 9, sag = 60, color = 'panel', alpha = 1, width = 4, phase = 0 } = {}) {
  const pts = [], n = loops * 14, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = u * loops * 6.283 + phase, droop = Math.sin(u * Math.PI) * sag;
    pts.push([x0 + dx * u + nx * Math.sin(a) * r, y0 + dy * u + ny * Math.sin(a) * r + droop + Math.cos(a) * r * 0.35]);
  }
  ctx.poly(pts, { color, alpha, width });
}
