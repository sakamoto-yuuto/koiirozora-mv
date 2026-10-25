// PRINTED MEMORY: the places and objects of V1 / B1 / C1 (74.61 - 173.81 s).
// A memory in this film is not a naturalistic set: it is a fragment pulled out of a phone message and pressed into
// paper (docs/VISUAL.md §1). Every helper is a pure function of (ctx, t, opts); nothing here touches the DOM at import.
//
//   shopStreet()       the dusk shopping street: three parallax planes, a halftone sun, long shadows, vertical lightboxes
//   noren()            a shop curtain that carries a line of type (the rest of a keyword line, set small)
//   prop()             one object on the table: the loaded art plate, or a labelled flat block while the art is missing
//   memoryTable()      the top view of the small table, objects leave it with a printed trail
//   platformScene()    the night platform, the fogged train window, さよなら written by a fingertip, h_wave
//   nightWindowScene() the dark room, the snowy window, y_sit, a small 夜 sign outside
//   glyphSnow()        「寂」 falling as snow and piling up one step per beat
//   frostGlass()       frost growing in from the edges of the glass as a dot screen, one advance per beat
//   steamCurls()       the two cups' steam, meeting above the table
//   hanko()            a red square seal pressed on a beat (ふたり)
//   recPanel()         the answering machine read-out: REC lamp and running tape counter
//   unitsPanel()       the 度数 LED in a corner
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, prog } from '../engine/util.js';
import { dotLight, dotCone, dotFill, misreg, beatEnv } from './print.js';
import { snow, fog, fingerText } from './world.js';

const FULL = { x: 0, y: 0, w: 1920, h: 1080 };

export const hasArt = (env, name) => !!env?.art?.ink?.[name];
export const artRoles = (accent = 'me') => ({ cream: 'text', orange: accent, black: 'panel' });

/** One prop: the loaded art plate, or a labelled flat block where the art is still missing (art_src/w3 -> assets/art). */
export function prop(ctx, env, name, { x, y, w = 190, h = 132, rot = 0, alpha = 1, offset = [7, 9], accent = 'you', roles = null } = {}) {
  if (alpha <= 0.004) return;
  const rl = roles ?? artRoles(accent);
  ctx.at(x, y, () => {
    if (hasArt(env, name)) {
      env.art.inks(ctx, name, { x: -w / 2, y: -h / 2, w, h }, { roles: rl, offset: { black: offset }, alpha });
      return;
    }
    // no plate yet: a flat pictogram of the object (still recognisable without reading), its name tiny beneath
    const s = Math.min(w, h) / 120;
    ctx.at(offset[0] * 0.8, offset[1] * 0.8, () => ctx.rrect(-w * 0.42, -h * 0.34, w * 0.84, h * 0.68, 18, { fill: 'bg', alpha: alpha * 0.42 }));
    ctx.at(0, 0, () => propIcon(ctx, name, s, alpha), { rot: -0.03 });
  }, { rot });
}

/**
 * A flat pictogram of one object of the table, drawn when its plate (art_src/w3 -> assets/art/o_*) is not loaded yet.
 * Size is in the prop's own units: the object fits in about 100 x 90 around (0, 0); s = its scale.
 */
function propIcon(ctx, name, s = 1, alpha = 1) {
  const A = (k) => alpha * k;
  ctx.at(0, 0, () => {
    switch (name) {
      case 'o_cassette': {
        ctx.rrect(-50, -32, 100, 64, 6, { fill: 'panel', stroke: 'text', width: 2, alpha: A(0.95) });
        ctx.rrect(-42, -25, 84, 38, 4, { fill: 'raised', alpha: A(0.95) });
        for (const cx of [-24, 24]) {
          ctx.circle(cx, -6, 14, { fill: true, color: 'text', alpha: A(0.9) });
          ctx.circle(cx, -6, 5, { fill: true, color: 'panel', alpha: A(0.95) });
          for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.5; ctx.line(cx + Math.cos(a) * 6, -6 + Math.sin(a) * 6, cx + Math.cos(a) * 13, -6 + Math.sin(a) * 13, { color: 'panel', width: 2, alpha: A(0.9) }); }
        }
        ctx.rect(-46, 20, 92, 7, { fill: true, color: 'me', alpha: A(0.85) });
        ctx.text('C-60', -40, 10, { size: 8, font: 'mono', color: 'sub', alpha: A(0.8) });
        break;
      }
      case 'o_keys': {
        ctx.circle(-34, -2, 16, { color: 'text', width: 3.5, alpha: A(0.95) });
        ctx.circle(-34, -2, 11, { color: 'text', width: 1.5, alpha: A(0.7) });
        for (const [i, y] of [[0, -16], [1, 0], [2, 16]].entries()) {
          ctx.at(-14, y[1], () => {
            ctx.rrect(0, 0, 46, 9, 4, { fill: 'text', alpha: A(0.95) });
            ctx.rect(26, 8, 8, 7, { fill: true, color: 'text', alpha: A(0.95) });
            ctx.rect(38, 8, 6, 9, { fill: true, color: 'text', alpha: A(0.95) });
            ctx.text('K', 5, 7, { size: 7, font: 'mono', color: 'panel', alpha: A(0.8) });
          }, { rot: -0.16 + y[0] * 0.14 });
        }
        ctx.text('H', -34, 3, { size: 9, font: 'mono', color: 'panel', align: 'center', alpha: A(0.8) });
        break;
      }
      case 'o_magazine': {
        ctx.at(0, 0, () => {
          ctx.rrect(-34, -47, 68, 94, 2, { fill: 'text', alpha: A(0.96) });
          for (let i = 0; i < 5; i++) ctx.line(36, -44 + i * 19, 40, -44 + i * 19, { color: 'line', width: 2, alpha: A(0.7) });
          ctx.rect(-28, -41, 56, 34, { fill: true, color: 'ice', alpha: A(0.75) });
          ctx.circle(0, -24, 11, { fill: true, color: 'sub', alpha: A(0.8) });
          ctx.rect(-28, 0, 56, 8, { fill: true, color: 'me', alpha: A(0.9) });
          for (let i = 0; i < 4; i++) ctx.line(-26, 18 + i * 9, -26 + [36, 28, 40, 20][i], 18 + i * 9, { color: 'line', width: 2, alpha: A(0.7) });
          ctx.text('1986', -28, 50, { size: 8, font: 'mono', color: 'line', alpha: A(0.8) });
        }, { rot: -0.1 });
        break;
      }
      case 'o_flower': {
        ctx.line(2, 44, 0, -4, { color: 'you', width: 3, alpha: A(0.95) });
        ctx.poly([[-1, 14], [-22, 6], [-3, 26]], { fill: true, color: 'youDim', alpha: A(0.9), close: true });
        ctx.poly([[1, 26], [22, 18], [3, 36]], { fill: true, color: 'youDim', alpha: A(0.8), close: true });
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; ctx.circle(Math.cos(a) * 15, -16 + Math.sin(a) * 15, 11, { fill: true, color: 'text', alpha: A(0.95) }); }
        ctx.circle(0, -16, 8, { fill: true, color: 'you', alpha: A(0.95) });
        break;
      }
      case 'o_gloves': {
        for (const side of [-1, 1]) {
          ctx.at(side * 18, 0, () => {
            ctx.rrect(-16, -26, 32, 54, 13, { fill: 'text', alpha: A(0.95) });
            ctx.at(side * 15, -18, () => ctx.rrect(-5, 0, 11, 26, 5, { fill: 'text', alpha: A(0.95) }), { rot: side * 0.5 });
            ctx.rrect(-16, 20, 32, 14, 5, { fill: 'you', alpha: A(0.9) });
            for (let i = 0; i < 3; i++) ctx.line(-10 + i * 9, -18, -10 + i * 9, 8, { color: 'line', width: 1.5, alpha: A(0.5) });
          }, { rot: side * 0.06 });
        }
        break;
      }
      case 'o_ticket': {
        ctx.rrect(-48, -22, 96, 44, 5, { fill: 'text', alpha: A(0.96) });
        ctx.g.save(); ctx.g.setLineDash([5, 5]);
        ctx.line(10, -18, 10, 18, { color: 'panel', width: 1.5, alpha: A(0.6) });
        ctx.g.restore();
        ctx.circle(10, -22, 5, { fill: true, color: 'panel', alpha: A(0.9) });
        ctx.circle(10, 22, 5, { fill: true, color: 'panel', alpha: A(0.9) });
        ctx.text('1986', 23, 6, { size: 11, font: 'mono', color: 'panel', alpha: A(0.9) });
        ctx.text('TICKET', -26, 6, { size: 9, font: 'mono', color: 'me', align: 'center', alpha: A(0.9) });
        break;
      }
      case 'o_photo': {
        ctx.rrect(-38, -46, 76, 92, 2, { fill: 'text', alpha: A(0.96) });
        ctx.rect(-30, -38, 60, 58, { fill: true, color: 'ice', alpha: A(0.8) });
        ctx.poly([[-30, 20], [-8, -6], [8, 8], [30, -18], [30, 20]], { fill: true, color: 'sub', alpha: A(0.9), close: true });
        ctx.circle(12, -26, 7, { fill: true, color: 'you', alpha: A(0.9) });
        ctx.line(-24, 32, 24, 32, { color: 'line', width: 2, alpha: A(0.5) });
        break;
      }
      case 'o_umbrella': {
        // open, seen from above: the canopy is a ribbed disc; the J handle shows past its edge
        ctx.poly([[0, 28], [0, 40], [2, 47], [7, 49], [12, 46]], { color: 'line', width: 4.5, alpha: A(0.95) });
        ctx.circle(0, -12, 42, { fill: true, color: 'text', alpha: A(0.96) });
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2; ctx.line(0, -12, Math.cos(a) * 40, -12 + Math.sin(a) * 40, { color: 'line', width: 1.6, alpha: A(0.75) }); }
        ctx.circle(0, -12, 42, { color: 'line', width: 2, alpha: A(0.8) });
        ctx.circle(0, -12, 6, { fill: true, color: 'you', alpha: A(0.95) });
        ctx.line(0, -54, 0, -44, { color: 'line', width: 3, alpha: A(0.9) });
        break;
      }
      case 'o_watch': {
        ctx.rrect(-19, -48, 38, 96, 10, { fill: 'youDim', alpha: A(0.95) });
        ctx.circle(0, -2, 28, { fill: true, color: 'text', alpha: A(0.97) });
        ctx.circle(0, -2, 23, { fill: true, color: 'panel', alpha: A(0.95) });
        ctx.circle(0, -2, 23, { color: 'line', width: 1, alpha: A(0.8) });
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.line(Math.cos(a) * 17, -2 + Math.sin(a) * 17, Math.cos(a) * 20, -2 + Math.sin(a) * 20, { color: 'text', width: 1.5, alpha: A(0.8) }); }
        ctx.line(0, -2, 0, -19, { color: 'text', width: 2.5, alpha: A(0.95) });
        ctx.line(0, -2, 12, 4, { color: 'me', width: 2, alpha: A(0.95) });
        ctx.circle(0, -2, 2.5, { fill: true, color: 'text', alpha: A(0.95) });
        ctx.rect(19, -4, 5, 8, { fill: true, color: 'you', alpha: A(0.9) });
        break;
      }
      default: {
        ctx.rrect(-48, -34, 96, 68, 8, { fill: 'panel', alpha: A(0.92) });
        ctx.rrect(-48, -34, 96, 68, 8, { fill: null, stroke: 'me', width: 2, alpha: A(0.65) });
        ctx.text(name.replace(/^o_/, ''), 0, 5, { size: 14, font: 'mono', color: 'text', align: 'center', alpha: A(0.85) });
      }
    }
  }, { scale: s });
}

/**
 * The dusk shopping street. camX = camera truck in px (positive = the camera moves right); the three planes move at
 * 0.28 / 0.62 / 1.18 of it. `signs` are the lightboxes: { text | chars: [{c,t}], x, y?, w?, h?, at? }.
 */
export function shopStreet(ctx, t, { camX = 0, sun = 1, signs = [], shadows = 1, off = [0, 0] } = {}) {
  const far = -camX * 0.28, mid = -camX * 0.62, near = -camX * 1.18, groundY = 796;
  // ---- far plane: the sky and its low amber sun ------------------------------------------------
  ctx.rect(-40, -40, 2000, 1160, { fill: true, color: 'panel' });
  dotLight(ctx, 1500 + far, 640, 1300, 'you', { sy: 0.3, alpha: 0.32 * sun, cell: 12 });
  const sx = 1440 + far, sy = 288;
  ctx.circle(sx, sy, 174, { fill: true, color: 'you', alpha: 0.12 * sun });
  dotFill(ctx, { x: sx - 180, y: sy - 180, w: 360, h: 360 }, 'you', {
    density: 0.95, cell: 9, alpha: 0.9 * sun,
    vary: (px, py) => { const d = Math.hypot(px - sx, py - sy); return d < 168 ? 1 - d / 420 : 0; },
  });
  ctx.circle(sx, sy, 174, { color: 'you', width: 2.5, alpha: 0.5 * sun });
  let x = -220 + (far % 210);
  while (x < 2140) {
    const k = Math.round(x - far), w = 120 + 160 * rand(131, k), h = 90 + 130 * rand(137, k), y = 620 - h;
    ctx.rect(x, y, w - 6, h + 6, { fill: true, color: 'bg', alpha: 0.92 });
    ctx.rect(x, y - 4, w - 6, 5, { fill: true, color: 'text', alpha: 0.16 });
    for (let q = 0; q < 3; q++) if (rand(141, k, q) > 0.55) ctx.rect(x + 16 + q * 34, y + 30, 18, 14, { fill: true, color: 'you', alpha: 0.32 });
    x += w + 20;
  }
  // ---- mid plane: the shop fronts --------------------------------------------------------------
  ctx.rect(-10, groundY, 1940, 1090 - groundY, { fill: true, color: 'bg' });
  if (shadows > 0) for (let i = -2; i < 9; i++) {                                 // the sun is low on the right: long shadows left
    const bx = i * 360 + mid, w = 330;
    ctx.poly([[bx, groundY], [bx + w, groundY], [bx + w - 300, 1080], [bx - 460, 1080]], { fill: true, color: 'panel', alpha: 0.4 * shadows, close: true });
  }
  for (let i = -2; i < 9; i++) {
    const bx = i * 360 + mid, w = 330;
    if (bx > 1980 || bx + w < -60) continue;
    const top = 466 + (i % 3) * 26;
    ctx.rect(bx, top, w, groundY - top, { fill: true, color: i % 2 ? 'raised' : 'bg' });
    ctx.rect(bx, top, w, 24, { fill: true, color: 'line', alpha: 0.55 });
    ctx.rect(bx + 14, top + 24, w - 28, 48, { fill: true, color: 'panel', alpha: 0.9 });     // signboard band (type is print ticks)
    for (let q = 0; q < 5; q++) ctx.rect(bx + 30 + q * 52, top + 40, 32 - q * 3, 12, { fill: true, color: 'text', alpha: 0.3 });
    // awning with stripes
    const ay = top + 96;
    ctx.poly([[bx - 8, ay], [bx + w + 8, ay], [bx + w - 22, ay + 58], [bx + 22, ay + 58]], { fill: true, color: 'raised', close: true });
    for (let q = 0; q < 7; q++) ctx.poly([[bx + 18 + q * 44, ay], [bx + 40 + q * 44, ay], [bx + 30 + q * 44, ay + 56], [bx + 8 + q * 44, ay + 56]], { fill: true, color: 'line', alpha: 0.55, close: true });
    // the lit shop window: a dot screen, warm
    const wy = ay + 70, wh = groundY - wy - 10;
    ctx.rect(bx + 26, wy, w - 52, wh, { fill: true, color: 'panel' });
    dotFill(ctx, { x: bx + 26, y: wy, w: w - 52, h: wh }, 'you', { density: 0.4, cell: 9, alpha: 0.75, vary: (px, py) => 0.5 + 0.5 * Math.sin(px * 0.05 + py * 0.02 + i) });
    for (let q = 0; q < 3; q++) ctx.line(bx + 26, wy + q * wh / 3, bx + w - 26, wy + q * wh / 3, { color: 'bg', width: 3, alpha: 0.5 });
    ctx.rect(bx + 26, wy, w - 52, wh, { color: 'line', width: 2, alpha: 0.6 });
    // a noren over the door
    const nx = bx + w - 112;
    ctx.rect(nx, wy, 76, 54, { fill: true, color: 'meDim', alpha: 0.85 });
    ctx.line(nx + 38, wy + 4, nx + 38, wy + 54, { color: 'bg', width: 2, alpha: 0.5 });
    // hairline outline (docs/VISUAL.md §1.4)
    ctx.line(bx, top, bx, groundY, { color: 'text', width: 1.4, alpha: 0.16 });
  }
  // ---- the road, kerb, rails, reflections ------------------------------------------------------
  ctx.rect(0, groundY, 1920, 1090 - groundY, { fill: true, color: 'panel' });
  dotFill(ctx, { x: 0, y: groundY, w: 1920, h: 1090 - groundY }, 'you', { density: 0.18, cell: 11, alpha: 0.5, vary: (px, py) => 0.4 + 0.6 * clamp((py - groundY) / 240) });
  ctx.rect(0, groundY - 6, 1920, 8, { fill: true, color: 'line', alpha: 0.55 });
  ctx.line(-30, 905, 1950, 900, { color: 'line', width: 2, alpha: 0.35 });
  ctx.line(-30, 960, 1950, 954, { color: 'line', width: 2, alpha: 0.28 });
  for (const rx of [300 + mid, 900 + mid, 1500 + mid]) {
    dotLight(ctx, rx, 930, 190, 'you', { sy: 0.16, alpha: 0.4, cell: 10 });
    ctx.rect(rx - 70, 928, 140, 4, { fill: true, color: 'you', alpha: 0.22 });
  }
  // ---- the lightboxes -------------------------------------------------------------------------
  for (const s of signs) {
    const bx = s.x + mid, y = s.y ?? 286, w = s.w ?? 118, h = s.h ?? 306;
    const at = s.at ?? (s.chars?.[0]?.t ?? 0), k = easeOut(clamp((t - at) / 0.22));
    ctx.rect(bx - 6, y - 74, 12, 74, { fill: true, color: 'bg', alpha: 0.95 });
    ctx.rect(bx - 34, y - 78, 68, 10, { fill: true, color: 'bg' });
    ctx.line(bx - 18, y - 68, bx - 18, y, { color: 'line', width: 2, alpha: 0.8 });
    ctx.line(bx + 18, y - 68, bx + 18, y, { color: 'line', width: 2, alpha: 0.8 });
    ctx.at(7 + off[0], 9 + off[1], () => ctx.rrect(bx - w / 2 - 8, y - 8, w + 16, h + 16, 5, { fill: 'bg', alpha: 0.55 }));
    ctx.rrect(bx - w / 2 - 8, y - 8, w + 16, h + 16, 5, { fill: 'panel', alpha: 0.96 });
    ctx.rrect(bx - w / 2, y, w, h, 3, { fill: 'you', alpha: 0.18 + 0.74 * k });
    if (k > 0.02) {
      ctx.glow('you', 36, () => ctx.rrect(bx - w / 2, y, w, h, 3, { fill: null, stroke: 'you', width: 2, alpha: 0.8 * k }), k);
      dotLight(ctx, bx, y + h + 80, 210, 'you', { alpha: 0.5 * k, sy: 0.42, cell: 10 });
    }
    const flat = (s.chars ?? [{ c: s.text, t: at }]).flatMap((c) => [...c.c].map((ch) => ({ ch, t: c.t })));
    const n = flat.length, pitch = Math.min(96, (h - 44) / Math.max(1, n), w * 0.82);
    flat.forEach((c, i) => {
      const kk = clamp((t - c.t) / 0.18), e = easeOut(kk);
      if (kk <= 0) return;
      ctx.text(c.ch, bx, y + (h - n * pitch) / 2 + (i + 1) * pitch - pitch * 0.28 + (1 - e) * 14, { size: pitch * 0.92, font: 'serif', weight: 700, color: 'panel', align: 'center', alpha: e * 0.95 });
    });
  }
  // ---- near plane: the pole and the wire, the closest thing to the lens ------------------------
  const px = 250 + near;
  ctx.rect(px, -20, 26, 1120, { fill: true, color: 'bg', alpha: 0.96 });
  ctx.rect(px - 74, 118, 174, 12, { fill: true, color: 'bg' });
  ctx.line(px + 6, 140, 1960, 44, { color: 'line', width: 2, alpha: 0.45 });
  ctx.rect(-40, 1014, 2000, 90, { fill: true, color: 'panel', alpha: 0.5 });
}

/** A shop curtain (noren) that carries the rest of a line in small type, one character per sung time. */
export function noren(ctx, t, { x = 1550, y = 286, w = 168, h = 292, chars = [], size = 26, color = 'text', off = [0, 0] } = {}) {
  ctx.at(9 + off[0], 11 + off[1], () => ctx.rrect(x, y, w, h, 8, { fill: 'bg', alpha: 0.45 }));
  ctx.rrect(x, y, w, h, 8, { fill: 'raised', alpha: 0.93 });
  ctx.rect(x, y, w, 15, { fill: true, color: 'line', alpha: 0.85 });
  ctx.line(x + w / 2, y + 18, x + w / 2, y + h, { color: 'bg', width: 3, alpha: 0.55 });
  ctx.line(x + 6, y + h - 3, x + w - 6, y + h - 3, { color: 'line', width: 1.5, alpha: 0.6 });
  chars.forEach((c, i) => {
    const k = clamp((t - c.t) / 0.18), e = easeOut(k);
    if (k <= 0) return;
    ctx.text(c.c, x + w / 2, y + 46 + i * size * 1.12, { size, font: 'serif', weight: 600, color, align: 'center', alpha: e * 0.92 });
  });
}

/**
 * The two cups' steam: two curls that lean toward each other and touch above the table, plus a small
 * beat-timed puff that rises between them (the tiny warm animation the table ends on).
 */
export function steamCurls(ctx, t, { x = 958, y = 486, k = 1, color = 'text', alpha = 0.42, warm = 0.6, beat = 0.8 } = {}) {
  if (k <= 0.01) return;
  const breathe = 0.72 + 0.28 * Math.sin(t * 2.1);
  for (const side of [-1, 1]) {
    for (let pass = 0; pass < 2; pass++) {
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const u = i / 18, wob = Math.sin(t * (1.5 + pass * 0.5) + u * (5.2 + pass * 1.6) + side * 1.7) * (5 + 26 * u);
        pts.push([x + side * (50 + 8 * u + pass * 7) - side * u * (26 + pass * 16) + wob * 0.35, y - 20 - u * (150 + pass * 34) - Math.sin(u * Math.PI) * 12]);
      }
      ctx.poly(pts, { color, alpha: alpha * k * (pass ? 0.42 : 0.9) * (0.8 + 0.2 * breathe), width: pass ? 1.6 : 2.4 });
    }
  }
  // a puff of breath leaves the cups on every two beats and dissolves one cup-height above them
  const per = Math.max(0.4, beat * 2), ph = (((t / per) % 1) + 1) % 1;
  for (let i = 0; i < 3; i++) {
    const u = ((ph + i / 3) % 1), a = (1 - u) * 0.34 * k * alpha;
    if (a < 0.01) continue;
    dotLight(ctx, x + Math.sin(u * 6.2 + i * 2.1) * 34 + (i - 1) * 26, y - 26 - u * 200, 24 + 46 * u, color, { alpha: a, cell: 9, sy: 0.8 });
  }
  dotLight(ctx, x, y - 176, 46, color, { alpha: 0.22 * k * breathe, cell: 9 });
  dotLight(ctx, x, y + 24, 190, 'you', { alpha: 0.15 * k * warm * breathe, cell: 12, sy: 0.5 });   // the warmth between them
}

/** The top view of the small table. items: [{ name, x, y, at, w?, h?, dir?: [dx, dy] }]; each slides off at `at`. */
export function memoryTable(ctx, env, t, { items = [], cupK = 1, steamK = null, camX = 0, off = [0, 0] } = {}) {
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel' });
  dotFill(ctx, FULL, 'you', { density: 0.09, cell: 15, alpha: 0.55 });
  dotLight(ctx, 960, 500, 760, 'you', { alpha: 0.22, cell: 13, sy: 0.85 });
  const tx = -camX * 0.1;
  ctx.at(tx, 0, () => {
    // ---- the paper table top (a sheet seen from above) ----------------------------------------
    ctx.at(10, 12, () => ctx.rrect(282, 124, 1298, 848, 28, { fill: 'bg', alpha: 0.55 }));
    ctx.rrect(282, 124, 1298, 848, 28, { fill: 'raised', alpha: 0.95 });
    ctx.rrect(304, 146, 1254, 804, 18, { fill: null, stroke: 'line', width: 2.5, alpha: 0.62 });
    for (const [rx, ry, rr] of [[430, 262, 46], [1288, 822, 34], [700, 862, 26]]) {
      ctx.circle(rx, ry, rr, { color: 'line', width: 2, alpha: 0.4 });
      ctx.circle(rx + 4, ry + 2, rr - 6, { color: 'line', width: 1.4, alpha: 0.28 });
    }
    ctx.line(340, 620, 1510, 606, { color: 'line', width: 1.4, alpha: 0.22 });
    for (let i = 0; i < 9; i++) ctx.line(320 + rand(51, i) * 1200, 160 + rand(53, i) * 760, 340 + rand(55, i) * 1200, 170 + rand(57, i) * 760, { color: 'line', width: 1, alpha: 0.12 });
    // a slow light sweep over the paper (so an empty beat still moves)
    dotLight(ctx, 700 + 420 * Math.sin(t * 0.23), 430, 520, 'you', { alpha: 0.1, cell: 14, sy: 0.7 });
    // ---- the objects: each leaves on its character, accelerated, with a printed motion trail ----
    for (const it of items) {
      const leave = clamp((t - it.at) / 0.82), k = easeOut(leave);
      const dir = it.dir ?? [1, 0];
      const path = (kk) => ({
        x: it.x + dir[0] * (260 * kk + 940 * kk * kk),
        y: it.y + dir[1] * (130 * kk + 340 * kk * kk) + kk * kk * 70,
        rot: kk * 0.8 * (dir[0] >= 0 ? 1 : -1),
      });
      const p = path(k), a = 1 - prog(leave, 0.72, 1);
      if (leave > 0.008 && leave < 1) {
        for (let q = 8; q >= 1; q--) {                                     // ghost plates: a long printed motion blur
          const kk = easeOut(clamp((t - it.at - q * 0.036) / 0.82)), g = path(kk);
          prop(ctx, env, it.name, {
            x: g.x, y: g.y, w: it.w, h: it.h, rot: g.rot,
            alpha: a * (0.2 / q) * (1 - q / 10), offset: [7 + off[0] + q * 2, 9 + off[1] + q * 3],
          });
        }
        const back = path(Math.max(0, k - 0.12));                          // the speed streak behind it
        ctx.line(back.x, back.y, p.x, p.y, { color: 'you', alpha: 0.28 * a, width: 3 });
        ctx.line(back.x + dir[1] * 24, back.y - dir[0] * 24, p.x + dir[1] * 18, p.y - dir[0] * 18, { color: 'text', alpha: 0.14 * a, width: 1.5 });
        // the paper's own print marks smeared along the exit path
        for (let q = 2; q <= 5; q++) {
          const g = path(Math.max(0, k - q * 0.09));
          ctx.circle(g.x, g.y, 2.2, { fill: true, color: 'you', alpha: a * 0.22 });
        }
      }
      prop(ctx, env, it.name, { x: p.x, y: p.y, w: it.w, h: it.h, alpha: a, rot: p.rot, offset: [7 + off[0], 9 + off[1]] });
      if (leave > 0 && leave < 0.8 && (it.i ?? 0) >= 0) {
        dotLight(ctx, p.x, p.y, 150, 'you', { alpha: 0.24 * (1 - leave), cell: 10 });
        ctx.circle(p.x, p.y, 26 + 90 * easeOut(leave), { color: 'you', width: 2, alpha: 0.18 * (1 - leave) });
      }
    }
    // ---- the cups, alone at the centre ---------------------------------------------------------
    if (cupK > 0.01) {
      const sk = steamK == null ? cupK : clamp(steamK);
      // the tiny warm animation at the end: the cups breathe, the paper under them warms, the steam puffs on the beat
      const warmPulse = 0.55 + 0.45 * Math.sin(t * 2.35);
      const breath = 1 + 0.006 * Math.sin(t * 1.8);
      dotLight(ctx, 958, 552, 330, 'you', { alpha: 0.12 * sk * (0.55 + 0.45 * warmPulse), cell: 12, sy: 0.7 });
      if (hasArt(env, 'o_cups')) {
        prop(ctx, env, 'o_cups', { x: 958, y: 540, w: 350 * breath, h: 276 * breath, alpha: cupK, offset: [8 + off[0], 10 + off[1]] });
      } else {
        // drawn stand-in: two cups seen from above, one cream, one amber, on saucers
        ctx.circle(958, 574, 236, { fill: true, color: 'you', alpha: 0.08 * cupK });
        for (const side of [-1, 1]) {
          const cx = 958 + side * 94, cy = 574 - (side < 0 ? 8 : 0), r = 88;
          ctx.at(8, 10, () => ctx.circle(cx, cy, r + 12, { color: 'bg', width: 8, alpha: 0.45 * cupK }));
          ctx.circle(cx, cy, r + 12, { color: 'line', width: 2, alpha: 0.7 * cupK });
          ctx.circle(cx, cy, r, { fill: true, color: side < 0 ? 'text' : 'you', alpha: 0.96 * cupK });
          ctx.circle(cx, cy, r - 13, { fill: true, color: side < 0 ? 'sub' : 'youDim', alpha: 0.9 * cupK });
          ctx.circle(cx, cy, r - 21, { fill: true, color: 'panel', alpha: 0.82 * cupK });
          ctx.circle(cx, cy, r - 21, { color: side < 0 ? 'text' : 'you', width: 2, alpha: 0.5 * cupK });
          ctx.at(cx + side * (r + 10), cy, () => ctx.circle(0, 0, 24, { color: side < 0 ? 'text' : 'you', width: 9, alpha: 0.9 * cupK }));
          for (let i = 0; i < 5; i++) { const a = i * 0.9 + side; ctx.circle(cx + Math.cos(a) * (r - 34), cy + Math.sin(a) * (r - 34), 3, { fill: true, color: 'raised', alpha: 0.5 * cupK }); }
        }
      }
      steamCurls(ctx, t, { x: 958, y: 496, k: sk, alpha: 0.56, warm: sk * (0.7 + 0.3 * warmPulse), beat: 0.8 });
      // two tiny warm grains leaving the rim on the beat
      for (let i = 0; i < 2; i++) {
        const u = ((t * 0.55 + i / 2) % 1);
        ctx.circle(958 + (i ? 30 : -30) + Math.sin(u * 7 + i) * 9, 508 - u * 70, 1.6 + 1.6 * (1 - u), { fill: true, color: 'you', alpha: 0.28 * sk * (1 - u) });
      }
    }
  });
}

/**
 * The night platform, brightened for the goodbye. travel = how far the train has pulled away (px, accelerated),
 * speed = its speed (px/s) so the ghost passes spread with the acceleration; write/wipe = the fingertip's writing
 * and the half-wipe, wave = 0..1 the hand in the foreground, dot = { x, y, r, alpha } him receding into the dark.
 */
export function platformScene(ctx, env, t, { camX = 0, travel = 0, speed = 0, write = 0, wipe = 0, wave = 0, dot = null, fogK = 0.9, off = [0, 0], lamp = 1 } = {}) {
  const lampX = 300 + camX * 0.06, edgeY = 706;
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel' });
  // ---- the night beyond: city glow, far roofs, snow ------------------------------------------
  dotLight(ctx, 1460 - camX * 0.2, 620, 1040, 'ice', { alpha: 0.27, cell: 14, sy: 0.38 });
  dotLight(ctx, 700 - camX * 0.16, 660, 700, 'you', { alpha: 0.08, cell: 14, sy: 0.2 });
  let bx = -200 + ((-camX * 0.15) % 240);
  while (bx < 2120) {
    const k = Math.round(bx + camX * 0.15), w = 190 + 160 * rand(171, k), h = 90 + 150 * rand(173, k);
    ctx.rect(bx, 640 - h, w - 8, h + 10, { fill: true, color: 'bg', alpha: 0.92 });
    for (let q = 0; q < 4; q++) if (rand(177, k, q) > 0.56) ctx.rect(bx + 20 + q * 36, 640 - h + 24, 16, 12, { fill: true, color: 'ice', alpha: 0.32 });
    ctx.rect(bx, 640 - h, w - 8, 4, { fill: true, color: 'text', alpha: 0.24 });
    bx += w;
  }
  dotFill(ctx, { x: 0, y: 0, w: 1920, h: 640 }, 'ice', { density: 0.035, cell: 16, alpha: 0.55 });
  snow(ctx, t, { r: { x: 0, y: 0, w: 1920, h: 700 }, count: 190, seed: 91, size: 3, speed: 52, alpha: 0.62, camX });
  // ---- canopy and its hanging lamps ----------------------------------------------------------
  ctx.rect(0, 0, 1920, 150, { fill: true, color: 'bg' });
  dotFill(ctx, { x: 0, y: 0, w: 1920, h: 150 }, 'panel', { density: 0.55, cell: 9, alpha: 0.7 });
  ctx.rect(0, 142, 1920, 10, { fill: true, color: 'line', alpha: 0.9 });
  ctx.line(0, 152, 1920, 152, { color: 'text', width: 1.4, alpha: 0.22 });
  for (const px of [760, 1340, 1780]) {
    const lx = px - camX * 0.5, fl = 0.75 + 0.25 * Math.sin(t * 3.1 + px);
    ctx.rect(lx - 5, 150, 10, 26, { fill: true, color: 'bg' });
    ctx.rrect(lx - 36, 176, 72, 20, 6, { fill: 'text', alpha: 0.92 * fl });
    dotLight(ctx, lx, 214, 190, 'ice', { alpha: 0.4 * fl, cell: 11, sy: 0.85 });
    dotCone(ctx, [lx, 196], [lx, 560], 230, 'ice', { alpha: 0.16 * fl, cell: 12, w0: 30 });
  }
  // ---- the platform floor, the edge line, the rails ------------------------------------------
  ctx.rect(0, 640, 1920, 440, { fill: true, color: 'bg', alpha: 0.96 });
  // a broad pool of station light on the paving: the platform has to read bright enough for the goodbye
  dotLight(ctx, 820 + camX * 0.04, 850, 980, 'ice', { alpha: 0.3, cell: 13, sy: 0.5 });
  dotFill(ctx, { x: 0, y: 640, w: 1920, h: 440 }, 'line', { density: 0.34, cell: 12, alpha: 0.66, vary: (px, py) => 0.3 + 0.7 * clamp((py - 640) / 440) });
  // the edge line, bright, with its dashes and tactile paving: the one thing that reads instantly as a platform
  ctx.rect(0, edgeY - 16, 1920, 9, { fill: true, color: 'you', alpha: 0.98 });
  for (let x = -20 + (camX * 0.2 % 90); x < 1940; x += 90) ctx.rect(x, edgeY - 16, 46, 9, { fill: true, color: 'text', alpha: 0.9 });
  dotFill(ctx, { x: 0, y: edgeY - 2, w: 1920, h: 64 }, 'you', { density: 0.36, cell: 10, alpha: 0.62, vary: (px, py) => 0.5 + 0.5 * Math.sin(px * 0.04 + py * 0.1) });
  // tactile paving strip and its joints
  ctx.rect(0, edgeY + 76, 1920, 48, { fill: true, color: 'raised', alpha: 0.85 });
  for (let x = -20 + (camX * 0.32 % 46); x < 1940; x += 46) ctx.rect(x, edgeY + 80, 30, 40, { fill: true, color: 'line', alpha: 0.4 });
  ctx.line(-40, 1002, 1960, 958, { color: 'line', width: 6, alpha: 0.95 });
  ctx.line(-40, 1042, 1960, 998, { color: 'line', width: 6, alpha: 0.95 });
  ctx.line(-40, 1002, 1960, 958, { color: 'text', width: 1.5, alpha: 0.32 });
  // the far-side station lamps (they appear when the train has gone)
  for (const px of [980, 1240, 1560, 1860]) {
    const lx = px - camX * 0.35, fl = 0.8 + 0.2 * Math.sin(t * 4.3 + px);
    ctx.rect(lx - 3, 470, 6, 170, { fill: true, color: 'line', alpha: 0.7 });
    ctx.circle(lx, 462, 7, { fill: true, color: 'text', alpha: 0.8 * fl });
    dotLight(ctx, lx, 466, 120, 'ice', { alpha: 0.48 * fl, cell: 10 });
  }
  // a low bench and a timetable frame: scale markers on the empty platform
  ctx.rect(1620 - camX * 0.08, 796, 260, 12, { fill: true, color: 'line', alpha: 0.75 });
  for (const bx of [1640, 1848]) ctx.rect(bx - camX * 0.08, 808, 8, 90, { fill: true, color: 'line', alpha: 0.8 });
  ctx.rrect(1200 - camX * 0.1, 548, 118, 148, 4, { fill: 'panel', alpha: 0.9 });
  ctx.rrect(1200 - camX * 0.1, 548, 118, 148, 4, { fill: null, stroke: 'text', width: 1.5, alpha: 0.42 });
  for (let i = 0; i < 6; i++) ctx.line(1212 - camX * 0.1, 572 + i * 18, 1302 - camX * 0.1, 572 + i * 18, { color: 'sub', width: 2, alpha: 0.34 });
  // ---- the train: accelerated ghost passes, then the body ------------------------------------
  const tx = 300 + travel + camX * 0.12;
  if (speed > 24) {
    // the faster it goes the longer the smear; every ghost is a whole car, not a strip
    const n = 8;
    ctx.trail(n, 0.034, (tau) => drawTrain(ctx, tx + off[0] - speed * tau, { flat: true, t }), 0.52);
    // light dragging off the carriage windows, so the pull-away is visible even at night
    for (let q = 1; q <= 6; q++) {
      const gx = tx + off[0] - speed * (q * 0.034);
      dotFill(ctx, { x: gx + 40, y: 320, w: 690, h: 270 }, 'ice', { density: 0.12, cell: 12, alpha: 0.1 * (1 - q / 7) });
    }
  } else {
    ctx.trail(2, 0.02, (tau) => drawTrain(ctx, tx + off[0] - tau * 60, { flat: true, t }), 0.2);
  }
  drawTrain(ctx, tx + off[0], { fogK, write, wipe, t });
  // the train's headlight rakes the empty platform as it leaves
  if (speed > 30) {
    const hx = tx + off[0] + 1510, a = clamp(speed / 900);
    dotLight(ctx, hx, 560, 520, 'text', { alpha: 0.18 * a, cell: 12, sy: 0.5 });
    ctx.rect(hx - 4, 548, 8, 10, { fill: true, color: 'text', alpha: 0.5 * a });
  }
  // ---- him: an amber dot walking out of the light into the dark ------------------------------
  if (dot) {
    const da = dot.alpha ?? 1, vx = dot.vx ?? 0, vy = dot.vy ?? 0;
    for (let q = 1; q <= 5; q++) {
      const gx = dot.x - vx * q * 0.045, gy = dot.y - vy * q * 0.045;
      ctx.circle(gx, gy, Math.max(1, dot.r * (1 - q * 0.14)), { fill: true, color: 'you', alpha: da * 0.22 / q });
    }
    dotLight(ctx, dot.x, dot.y, 40 + dot.r * 9, 'you', { alpha: 0.62 * da, cell: 9 });
    ctx.circle(dot.x, dot.y, dot.r, { fill: true, color: 'you', alpha: 0.96 * da });
    ctx.circle(dot.x, dot.y, Math.max(1, dot.r * 0.48), { fill: true, color: 'youHot', alpha: 0.9 * da });
    // the tiny shadow he leaves on the snow
    ctx.rect(dot.x - dot.r * 1.2, dot.y + dot.r + 4, dot.r * 2.4, 3, { fill: true, color: 'panel', alpha: 0.4 * da });
  }
  // ---- the platform lamp in the foreground: one dot-cone, the brightest thing on the platform -
  if (lamp > 0.01) {
    const fl = 0.86 + 0.14 * Math.sin(t * 2.4);
    ctx.rect(lampX - 8, 120, 16, 646, { fill: true, color: 'bg', alpha: 0.98 });
    ctx.rect(lampX - 54, 108, 108, 16, { fill: true, color: 'bg' });
    ctx.rrect(lampX - 44, 124, 88, 26, 9, { fill: 'text', alpha: 0.96 * fl });
    dotCone(ctx, [lampX, 150], [lampX, 830], 500, 'ice', { alpha: 0.78 * lamp * fl, cell: 11, w0: 36 });
    dotLight(ctx, lampX, 840, 620, 'ice', { sy: 0.26, alpha: 0.92 * lamp * fl, cell: 10 });
    ctx.glow('ice', 44, () => ctx.rect(lampX - 42, 128, 84, 18, { fill: true, color: 'text', alpha: 0.98 * fl }), lamp * fl);
    ctx.line(lampX - 26, 151, lampX + 26, 151, { color: 'ice', width: 2, alpha: 0.7 });
    // its reflection down the wet paving
    dotFill(ctx, { x: lampX - 90, y: 808, w: 180, h: 240 }, 'ice', { density: 0.22, cell: 12, alpha: 0.3 * fl, vary: (px, py) => clamp((py - 808) / 240) * 0.9 });
  }
  // ---- the pillar with the station-name board: 「明星」, made up --------------------------------
  ctx.rect(34, 300, 132, 780, { fill: true, color: 'bg', alpha: 0.98 });
  ctx.rect(34, 300, 132, 780, { color: 'line', width: 1.4, alpha: 0.62 });
  ctx.rect(34, 300, 132, 8, { fill: true, color: 'text', alpha: 0.25 });
  ctx.rrect(40, 324, 120, 372, 6, { fill: 'panel', alpha: 0.98 });
  ctx.rrect(46, 330, 108, 360, 6, { fill: 'text', alpha: 0.1 });
  ctx.rrect(46, 330, 108, 360, 6, { color: 'text', width: 2, alpha: 0.7 });
  ctx.text('明', 100, 452, { size: 92, font: 'sans', weight: 900, color: 'text', align: 'center', alpha: 0.98 });
  ctx.text('星', 100, 568, { size: 92, font: 'sans', weight: 900, color: 'text', align: 'center', alpha: 0.98 });
  ctx.text('MEISEI', 100, 626, { size: 18, font: 'mono', color: 'sub', align: 'center', alpha: 0.95 });
  ctx.text('PLATFORM 2', 100, 662, { size: 13, font: 'mono', color: 'mute', align: 'center', alpha: 0.95 });
  // the board is lit from beneath, one small dot cone
  dotLight(ctx, 100, 700, 210, 'you', { alpha: 0.3, cell: 11, sy: 0.55 });
  dotCone(ctx, [100, 676], [100, 810], 110, 'you', { alpha: 0.2, cell: 13, w0: 30 });
  // white edge light on the pillar, so it does not disappear into the night
  ctx.line(166, 306, 166, 1076, { color: 'ice', width: 2, alpha: 0.34 });
  // ---- h_wave in the foreground --------------------------------------------------------------
  if (hasArt(env, 'h_wave')) {
    const swing = Math.sin(t * 5.2) * 0.07 * wave;
    ctx.at(1540, 800, () => {
      env.art.inks(ctx, 'h_wave', { x: -270, y: -330, w: 540, h: 660 }, {
        roles: { cream: 'text', orange: 'me', black: 'panel' },
        offset: { black: misreg(t, 61, { base: 6, kick: 16, cut: null, beatEnv: 0.4 * beatEnv(env, t, 5) }), orange: [2, 0] },
        alpha: 0.95,
      });
    }, { rot: -0.08 + swing });
  } else {
    ctx.at(1470, 700, () => {
      ctx.rrect(-130, -260, 260, 520, 90, { fill: 'text', alpha: 0.9 });
      for (let i = 0; i < 4; i++) ctx.rrect(-120 + i * 60, -300, 50, 150, 22, { fill: 'text', alpha: 0.9 });
      ctx.rrect(-90, -120, 180, 300, 60, { fill: 'me', alpha: 0.5 });
    }, { rot: -0.08 + Math.sin(t * 5.2) * 0.07 * wave });
  }
  // foreground snow and the platform edge shading
  snow(ctx, t, { r: { x: 0, y: 520, w: 1920, h: 560 }, count: 70, seed: 93, size: 4.6, speed: 96, alpha: 0.38, camX });
  dotFill(ctx, { x: 0, y: 900, w: 1920, h: 180 }, 'panel', { density: 0.3, cell: 12, alpha: 0.55, vary: (px, py) => clamp((py - 900) / 180) });
  ctx.rect(-40, 1006, 2000, 90, { fill: true, color: 'panel', alpha: 0.55 });
}

/** One train: two cars with lit windows; the nearest window carries さよなら. flat = the motion-blur ghost pass. */
function drawTrain(ctx, x, { flat = false, fogK = 0, write = 0, wipe = 0, t = 0 } = {}) {
  if (x > 2200 || x + 1600 < -120) return;
  for (let c = 0; c < 2; c++) {
    const cx = x + c * 800, cy = 150, cw = 760, ch = 540;
    ctx.rect(cx, cy, cw, ch, { fill: true, color: 'raised', alpha: 0.98 });
    ctx.rect(cx, cy, cw, 18, { fill: true, color: 'text', alpha: 0.38 });        // snow on the roof
    ctx.rect(cx, cy + ch - 150, cw, 150, { fill: true, color: 'panel', alpha: 0.92 });
    ctx.rect(cx, cy + ch - 150, cw, 8, { fill: true, color: 'you', alpha: 0.28 });       // a warm skirt light
    ctx.rect(cx, cy + 18, cw, 8, { fill: true, color: 'ice', alpha: 0.4 });
    ctx.rect(cx, cy + 150, cw, 12, { fill: true, color: 'line', alpha: 0.9 });
    // the destination board over the end door
    ctx.rrect(cx + cw - 250, cy + 40, 210, 34, 4, { fill: 'panel', alpha: 0.9 });
    if (!flat) ctx.text(c ? 'MEISEI LINE' : 'MEISEI LINE', cx + cw - 145, cy + 64, { size: 20, font: 'mono', color: 'text', align: 'center', alpha: 0.72 });
    for (let w = 0; w < 2; w++) {
      const wx = cx + 38 + w * 348, wy = cy + 178, ww = 300, wh = 244;
      ctx.rect(wx, wy, ww, wh, { fill: true, color: 'panel', alpha: 0.95 });
      ctx.rect(wx, wy, ww, wh, { color: 'line', width: 3, alpha: 0.75 });
      if (flat) continue;
      ctx.rect(wx + 10, wy + 10, ww - 20, wh - 20, { fill: true, color: 'ice', alpha: 0.1 });
      if (!(c === 0 && w === 0)) {
        // a lit carriage: pale seats and a strap line, a dot screen, so the train reads as a train
        ctx.rect(wx + 10, wy + 10, ww - 20, wh - 20, { fill: true, color: 'text', alpha: 0.08 });
        ctx.rect(wx + 18, wy + wh - 66, ww - 36, 46, { fill: true, color: 'sub', alpha: 0.24 });
        ctx.line(wx + 20, wy + 44, wx + ww - 20, wy + 40, { color: 'text', width: 2, alpha: 0.22 });
        for (let q = 0; q < 5; q++) ctx.line(wx + 40 + q * 56, wy + 40, wx + 40 + q * 56, wy + 70, { color: 'text', width: 2, alpha: 0.18 });
        dotFill(ctx, { x: wx, y: wy, w: ww, h: wh }, 'ice', { density: 0.16, cell: 12, alpha: 0.62 });
        // the ceiling tube inside the carriage, sliding across the window as the train pulls out
        const tube = wx + 40 + ((t * 46 + w * 130 + c * 220) % Math.max(60, ww - 100));
        dotLight(ctx, tube, wy + 28, 130, 'text', { alpha: 0.32, cell: 9, sy: 0.45 });
      }
      if (c === 0 && w === 0) {
        const win = { x: wx + 8, y: wy + 8, w: ww - 16, h: wh - 16 };
        ctx.clip(win, () => {
          // a lit pane of condensation: the fog is the light here, and the finger takes it away
          ctx.rect(win.x, win.y, win.w, win.h, { fill: true, color: 'text', alpha: 0.2 + 0.1 * fogK });
          fog(ctx, win, { k: Math.min(1, fogK + 0.1), cell: 7, seed: 43, alpha: 0.85 });
          dotFill(ctx, { x: win.x, y: win.y, w: win.w, h: win.h }, 'text', { density: 0.26, cell: 11, alpha: 0.5 });
          if (write > 0) {
            // the fingertip's stroke: serif is what the bundled fonts carry for さよなら (hand only preloads 恋色空…)
            const tip = fingerText(ctx, 'さよなら', win.x + 14, win.y + win.h * 0.66, { size: 54, k: write, color: 'panel', font: 'serif', alpha: 1, drips: false, t, gap: 0.1 });
            if (tip) {
              dotLight(ctx, tip[0], tip[1], 60, 'text', { alpha: 0.5, cell: 7 });
              ctx.circle(tip[0], tip[1], 7, { fill: true, color: 'text', alpha: 0.9 });
            }
            if (write < 1) for (let q = 1; q <= 4; q++) ctx.circle(win.x + 14 + write * 190 - q * 12, win.y + win.h * 0.66 - q * 3, 3, { fill: true, color: 'panel', alpha: 0.3 });
          }
          if (wipe > 0.01) {                                                        // half wiped by a sleeve
            const edge = [];
            for (let i = 0; i <= 12; i++) edge.push([win.x + win.w * 0.46 + Math.sin(i * 1.9 + 0.7) * 22 - wipe * 30, win.y + (i / 12) * win.h]);
            ctx.poly([...edge, [win.x + win.w + 20, win.y], [win.x + win.w + 20, win.y + win.h]], { fill: true, color: 'text', alpha: 0.2 * wipe, close: true });
            dotFill(ctx, { x: win.x + win.w * 0.4, y: win.y, w: win.w * 0.62, h: win.h }, 'text', { density: 0.2 * wipe, cell: 9, alpha: 0.6 });
            for (let s = 0; s < 7; s++) ctx.line(win.x + win.w * 0.56 + s * 14, win.y + 18, win.x + win.w * 0.46 + s * 14 - wipe * 18, win.y + win.h - 18, { color: 'text', width: 2, alpha: 0.08 * wipe });
          }
          dotFill(ctx, win, 'ice', { density: 0.07, cell: 12, alpha: 0.4 });
        });
      }
    }
    // doors and skirt
    ctx.rect(cx + 690, cy + 160, 44, ch - 170, { fill: true, color: 'panel', alpha: 0.9 });
    ctx.rect(cx + 16, cy + ch - 34, cw - 32, 12, { fill: true, color: 'you', alpha: 0.38 });
    ctx.line(cx + 16, cy + ch - 34, cx + cw - 16, cy + ch - 34, { color: 'text', width: 1.2, alpha: 0.25 });
    for (const bx of [140, 620]) {                                        // bogies
      ctx.circle(cx + bx, cy + ch + 26, 34, { fill: true, color: 'panel' });
      ctx.circle(cx + bx, cy + ch + 26, 18, { fill: true, color: 'line' });
    }
    // the headlight of the leading end (the train is leaving to the right)
    if (c === 1) {
      dotLight(ctx, cx + cw + 6, cy + 300, 150, 'text', { alpha: 0.6, cell: 9 });
      ctx.circle(cx + cw + 2, cy + 300, 9, { fill: true, color: 'text', alpha: 0.9 });
    }
  }
}

/**
 * Extreme close-up of the answering machine's tape deck and counter, in its own units (W 1000 x H 620).
 * The 3-digit counter is drawn large enough to hold 時間: on 時 / 間 the first two digit cells ARE those characters
 * (toki.j / toki.k = their landing progress), the third keeps rolling. Returns the geometry (local units) so the
 * caller can flicker memory vignettes inside the smoked cassette window.
 */
export function tapeCounter(ctx, t, { reel = 0, counter = 118, toki = null, rec = 1, blink = 1, alpha = 1 } = {}) {
  const win = { x: 40, y: 46, w: 540, h: 430 };
  const cells = { x: 624, y: 112, w: 104, h: 150, gap: 8 };
  ctx.at(16, 18, () => ctx.rrect(0, 0, 1000, 620, 26, { fill: 'bg', alpha: alpha * 0.74 }));
  ctx.rrect(0, 0, 1000, 620, 26, { fill: 'sub', alpha });
  ctx.rrect(10, 10, 980, 600, 20, { fill: null, stroke: 'text', width: 1.5, strokeAlpha: 0.16, alpha });
  dotFill(ctx, { x: 610, y: 350, w: 390, h: 270 }, 'line', { density: 0.2, cell: 8, alpha: alpha * 0.8 });
  dotFill(ctx, { x: 0, y: 430, w: 610, h: 190 }, 'line', { density: 0.14, cell: 9, alpha: alpha * 0.6 });
  // ---- the smoked cassette window: two reels, tape band ------------------------------------------
  ctx.rrect(win.x, win.y, win.w, win.h, 14, { fill: 'panel', alpha });
  ctx.rrect(win.x, win.y, win.w, win.h, 14, { fill: null, stroke: 'line', width: 2.5, alpha: alpha * 0.9 });
  ctx.line(176, 262, 444, 262, { color: 'youDim', width: 26, alpha: alpha * 0.8 });
  for (const cx of [176, 444]) {
    ctx.at(cx, 262, () => {
      ctx.circle(0, 0, 116, { fill: true, color: 'raised', alpha });
      ctx.circle(0, 0, 100, { fill: true, color: 'bg', alpha: alpha * 0.55 });
      ctx.circle(0, 0, 86, { color: 'line', width: 1.5, alpha: alpha * 0.75 });
      ctx.at(0, 0, () => {
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.line(Math.cos(a) * 22, Math.sin(a) * 22, Math.cos(a) * 74, Math.sin(a) * 74, { color: 'sub', width: 9, alpha }); }
      }, { rot: reel });
      ctx.circle(0, 0, 24, { fill: true, color: 'text', alpha });
      ctx.circle(0, 0, 10, { fill: true, color: 'panel', alpha });
    });
  }
  ctx.text('MICRO CASSETTE', win.x + win.w / 2, 452, { size: 15, font: 'mono', color: 'mute', align: 'center', alpha: alpha * 0.9 });
  // ---- the counter module ------------------------------------------------------------------------
  ctx.rrect(604, 54, 374, 300, 12, { fill: 'panel', alpha });
  ctx.rrect(604, 54, 374, 300, 12, { fill: null, stroke: 'line', width: 2, alpha: alpha * 0.85 });
  ctx.text('TAPE COUNTER', 624, 82, { size: 15, font: 'mono', color: 'mute', alpha: alpha * 0.9 });
  const str = String(Math.max(0, Math.floor(counter)) % 1000).padStart(3, '0');
  for (let i = 0; i < 3; i++) {
    const x = cells.x + i * (cells.w + cells.gap);
    ctx.rrect(x, cells.y, cells.w, cells.h, 5, { fill: 'bg', alpha: alpha * 0.95 });
    ctx.rrect(x, cells.y, cells.w, cells.h, 5, { fill: null, stroke: 'line', width: 1.5, alpha: alpha * 0.65 });
    const k = i === 0 ? (toki?.j ?? 0) : i === 1 ? (toki?.k ?? 0) : 0;
    const glyph = k > 0.001 && i < 2;
    const ch = glyph ? (i === 0 ? '時' : '間') : str[i];
    const e = easeOut(clamp(k));
    if (glyph) {
      ctx.at(14, 18, () => ctx.text(ch, x + cells.w / 2, cells.y + 118, { size: 128, font: 'serif', weight: 700, color: 'bg', align: 'center', alpha: alpha * 0.35 * e }));
      ctx.text(ch, x + cells.w / 2, cells.y + 118 - (1 - e) * 12, { size: 128, font: 'serif', weight: 700, color: 'text', align: 'center', alpha: alpha * e });
    } else {
      ctx.text(ch, x + cells.w / 2, cells.y + 122, { size: 124, font: 'mono', weight: 300, color: 'text', align: 'center', alpha });
    }
  }
  if (toki?.k > 0.02) ctx.text('とき', cells.x + cells.w + cells.gap + cells.w / 2, 296, { size: 26, font: 'serif', weight: 500, color: 'text', align: 'center', alpha: alpha * easeOut(toki.k) * 0.9 });
  ctx.text('DIGIT', 958, 82, { size: 12, font: 'mono', color: 'mute', align: 'right', alpha: alpha * 0.8 });
  // ---- the machine under the deck: REC lamp, 用件, keys -----------------------------------------
  ctx.circle(900, 406, 20, { fill: true, color: rec > 0.05 ? 'err' : 'errDim', alpha: alpha * (0.4 + 0.6 * rec) * blink });
  if (rec > 0.05) ctx.glow('err', 30, () => ctx.circle(900, 406, 16, { fill: true, color: 'err', alpha: alpha * rec * blink }), alpha * rec);
  ctx.text('REC', 872, 462, { size: 16, font: 'mono', weight: 700, color: 'text', alpha: alpha * 0.9 });
  ctx.rrect(624, 372, 128, 118, 8, { fill: 'panel', alpha });
  ctx.text('用件', 688, 398, { size: 17, font: 'sans', weight: 700, color: 'text', align: 'center', alpha });
  ctx.text('1', 688, 468, { size: 54, font: 'mono', weight: 300, color: 'err', align: 'center', alpha });
  for (let i = 0; i < 4; i++) {
    ctx.rrect(624 + i * 86, 512, 76, 62, 8, { fill: 'raised', alpha });
    ctx.text(['留守', '再生', '停止', '消去'][i], 662 + i * 86, 552, { size: 17, font: 'sans', weight: 700, color: 'panel', align: 'center', alpha });
  }
  return { win, cells };
}

/**
 * The dark room and the snowy window, with her seated by it; a small 夜 sign outside lights when it is sung.
 * Once per bar a car's headlight sweeps across the room as a moving dot-screen band — for those seconds it is the
 * only light in the room — and her hair plate drifts a few pixels against the body.
 */
export function nightWindowScene(ctx, env, t, { camX = 0, signK = 0, snowK = 1, cut = null } = {}) {
  const P = env.features?.period ?? 0.8, t0 = env.features?.t0 ?? 0.21;
  const bp = (((t - t0) % (4 * P)) + 4 * P) % (4 * P);
  // once a bar, one car: the beam crosses the whole room in ~1.7 s, then the room goes dark again
  const on = bp > 0.18 && bp < 2.16;
  const su = clamp((bp - 0.18) / 1.62);                       // 0..1: the beam crosses the room
  const sk = on ? Math.sin(Math.PI * clamp((bp - 0.18) / 2.0)) : 0;
  const breath = beatEnv(env, t, 4);
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel' });
  dotLight(ctx, 1100, 430, 950, 'ice', { alpha: 0.1 + 0.04 * breath, cell: 15 });
  const wx = 760 - camX * 0.14;
  // window reveal and frame
  ctx.rect(wx - 34, 36, 768, 872, { fill: true, color: 'bg' });
  ctx.clip({ x: wx, y: 70, w: 700, h: 800 }, () => {
    ctx.rect(wx, 70, 700, 800, { fill: true, color: 'panel' });
    dotLight(ctx, wx + 470, 300, 500, 'ice', { alpha: 0.4 + 0.1 * breath, cell: 12 });
    for (let i = 0; i < 6; i++) {                                          // the roofs outside
      ctx.rect(wx - 40 + i * 132, 510 + (i % 3) * 36, 118, 300, { fill: true, color: 'bg', alpha: 0.92 });
      ctx.rect(wx - 40 + i * 132, 508 + (i % 3) * 36, 118, 5, { fill: true, color: 'text', alpha: 0.2 });
    }
    snow(ctx, t, { r: { x: wx, y: 70, w: 700, h: 800 }, count: 220, seed: 29, size: 3, speed: 64, alpha: 0.8 * snowK, wind: 26 });
    // the car outside: two headlights crossing the snow at the sill, once per bar
    if (sk > 0.01) {
      const hx = wx - 120 + su * 980, hy = 806;
      ctx.trail(4, 0.05, (tau) => ctx.circle(hx - tau * 260, hy, 5, { fill: true, color: 'text', alpha: 0.5 * sk }), 0.4);
      dotLight(ctx, hx, hy, 120, 'text', { alpha: 0.6 * sk, cell: 8, sy: 0.7 });
      ctx.circle(hx - 28, hy, 7, { fill: true, color: 'text', alpha: 0.9 * sk });
      ctx.circle(hx + 28, hy, 7, { fill: true, color: 'text', alpha: 0.9 * sk });
      ctx.rect(hx - 70, hy - 26, 140, 26, { fill: true, color: 'panel', alpha: 0.75 * sk });
    }
    if (signK > 0.01) {
      const sgx = wx + 566, sgy = 330, flick = 0.82 + 0.18 * Math.sin(t * 9.7);
      ctx.rrect(sgx - 38, sgy - 72, 76, 144, 6, { fill: 'ice', alpha: 0.88 * signK * flick });
      ctx.rrect(sgx - 38, sgy - 72, 76, 144, 6, { fill: null, stroke: 'text', width: 2, alpha: 0.5 * signK });
      ctx.text('夜', sgx, sgy + 22, { size: 66, font: 'serif', weight: 700, color: 'panel', align: 'center', alpha: signK });
      dotLight(ctx, sgx, sgy + 90, 190, 'ice', { alpha: 0.45 * signK * flick, cell: 10 });
    }
    // a reflection of the headlight on the wet glass, drawn as a thin band
    if (sk > 0.01) {
      const rx = wx - 200 + su * 1100;
      dotFill(ctx, { x: wx, y: 70, w: 700, h: 800 }, 'text', {
        pts: [[rx - 50, 70], [rx + 30, 70], [rx + 260, 870], [rx + 150, 870]], density: 0.25, cell: 12, alpha: 0.35 * sk,
      });
    }
    dotFill(ctx, { x: wx, y: 70, w: 700, h: 800 }, 'ice', { density: 0.05, cell: 14, alpha: 0.35 });
  });
  // sash bars and sill
  ctx.rect(wx + 338, 70, 22, 800, { fill: true, color: 'bg' });
  ctx.rect(wx, 468, 700, 20, { fill: true, color: 'bg' });
  ctx.rect(wx - 34, 36, 768, 30, { fill: true, color: 'bg' });
  ctx.rect(wx - 60, 862, 690, 26, { fill: true, color: 'raised' });
  ctx.rect(wx - 60, 862, 690, 26, { color: 'line', width: 2, alpha: 0.6 });
  // the light through the window on the floor: a dot screen parallelogram
  const pts = [[wx + 60, 888], [wx + 640, 888], [wx + 420, 1080], [wx - 380, 1080]];
  dotFill(ctx, { x: 0, y: 860, w: 1920, h: 230 }, 'ice', { pts, density: 0.13, cell: 11, alpha: 0.55 });
  // the curtain, left of the window: its edge sways
  const ce = wx - 70 + Math.sin(t * 0.9) * 7 + Math.sin(t * 2.3) * 2;
  ctx.poly([[wx - 240, 40], [ce, 40], [ce - 8 + Math.sin(t * 0.8 + 1.7) * 8, 884], [wx - 240, 884]], { fill: true, color: 'bg', alpha: 0.96, close: true });
  for (let i = 0; i < 7; i++) ctx.line(wx - 232 + i * 24, 44, wx - 250 + i * 24 + (ce - (wx - 70)) * 0.5, 884, { color: 'line', width: 2, alpha: 0.25 });
  ctx.rect(wx - 250, 34, 200, 12, { fill: true, color: 'line', alpha: 0.8 });
  // her, seated, breathing; the hair plate drifts a little against the body
  if (hasArt(env, 'y_sit')) {
    const br = 1 + 0.006 * Math.sin(t * 1.5), w = 700 * br, h = 940 * br;
    const off = misreg(t, 47, { base: 6, kick: 14, cut, beatEnv: 0.5 * beatEnv(env, t, 5) });
    const hx = 8 * Math.sin(t * 1.07) + 3 * Math.sin(t * 2.9), hy = 4.5 * Math.cos(t * 0.83) + 1.5 * Math.sin(t * 1.7);
    env.art.inks(ctx, 'y_sit', { x: 200 - (w - 700) / 2, y: 130 - (h - 940) + camX * 0.06, w, h }, {
      plates: [
        { ink: 'cream', role: 'sub', offset: [off[0] * 0.4, off[1] * 0.4] },
        { ink: 'orange', role: 'me', offset: [off[0] * 0.5 + hx, off[1] * 0.5 + hy] },
        { ink: 'black', role: 'panel', offset: [off[0], off[1]] },
      ],
      alpha: 0.97,
    });
  }
  // ---- the headlight band: a moving dot screen over the room, the only light in it -------------
  if (sk > 0.01) {
    // the room falls back into the dark the moment the car enters the frame, so the band alone is the light
    ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel', alpha: 0.34 * sk });
    const bx = -620 + su * 2860;
    const band = [[bx - 210, 120], [bx + 100, 120], [bx + 560, 1080], [bx + 40, 1080]];
    dotFill(ctx, { x: bx - 280, y: 120, w: 980, h: 960 }, 'text', {
      pts: band, density: 0.36, cell: 9, alpha: 0.52 * sk,
      vary: (px, py) => clamp(1 - Math.abs(px - (bx + 250 + (py - 120) * 0.18)) / 390),
    });
    // the bright core of the beam, and a second band that runs a frame behind it
    dotFill(ctx, { x: bx - 180, y: 120, w: 640, h: 960 }, 'text', {
      pts: [[bx - 60, 120], [bx + 96, 120], [bx + 330, 1080], [bx + 140, 1080]], density: 0.52, cell: 9, alpha: 0.7 * sk,
    });
    dotFill(ctx, { x: bx - 300, y: 120, w: 500, h: 960 }, 'text', {
      pts: [[bx - 240, 120], [bx - 180, 120], [bx + 20, 1080], [bx - 70, 1080]], density: 0.3, cell: 12, alpha: 0.26 * sk,
    });
    dotLight(ctx, bx + 250, 900, 460, 'text', { alpha: 0.38 * sk, cell: 10, sy: 0.3 });
    // dust in the beam
    for (let i = 0; i < 24; i++) {
      const u = rand(501, i, 1), v = rand(503, i, 2);
      const x = bx - 120 + v * 460 + Math.sin(t * 0.9 + i) * 9, y = 220 + u * 800;
      ctx.circle(x, y, 1.5 + 2.2 * rand(505, i, 3), { fill: true, color: 'text', alpha: 0.3 * sk });
    }
  }
  // foreground chair back / floor shade
  ctx.rect(-40, 1010, 2000, 90, { fill: true, color: 'panel', alpha: 0.55 });
}

/** 「寂」 falling like snow; the pile at the bottom rises one step on every beat. */
export function glyphSnow(ctx, t, { from = 0, pileAt = 0, calmX = 1500, seed = 5, anchor = 0.8, off = [0, 0] } = {}) {
  ctx.rect(0, 0, 1920, 1080, { fill: true, color: 'panel' });
  dotLight(ctx, 900, 260, 940, 'ice', { alpha: 0.2, cell: 15 });
  const elapsed = Math.max(0, t - from), step = Math.max(0, Math.floor((t - pileAt) / anchor + 1e-6));
  const pileH = 44 + step * 21;
  // the pile is lower under the lyric column on the right, so the words stay on paper
  const topAt = (x) => 1080 - pileH - 30 * Math.sin((x / 1920) * Math.PI) - 14 * Math.sin(x * 0.019 + 1.2) + 150 * clamp((x - 1450) / 400);
  for (let i = 0; i < 300; i++) {
    const z = 0.28 + 0.72 * rand(seed, i, 1), speed = 55 + 175 * rand(seed, i, 2);
    const size = (24 + 58 * rand(seed, i, 3)) * z;
    const x = rand(seed, i, 4) * 2000 - 40 + Math.sin(t * 0.7 + i) * 22 * z;
    if (x > calmX) continue;                                             // keep the lyric column calm
    const y = ((elapsed * speed + rand(seed, i, 5) * 1520) % 1520) - 130;
    if (y > topAt(x) - size) continue;                                    // buried in the pile
    ctx.text('寂', x, y, { size, font: 'serif', weight: 600, color: 'text', alpha: 0.22 + 0.58 * z, align: 'center' });
  }
  // the pile: 寂 pressed over one another, each still legible, the drift highest where it is deepest
  for (let y = 1080 - pileH - 16, row = 0; y < 1080 + 20; y += 34, row++) {
    for (let x = ((row % 2) * 20) - 12; x < 1920; x += 40) {
      if (y < topAt(x) - 12) continue;
      const a = 0.5 + 0.44 * rand(seed, Math.round(x), Math.round(y));
      ctx.text('寂', x + 18 + off[0], y + 26 + off[1], { size: 36 + 12 * rand(seed, Math.round(y), 2), font: 'serif', weight: 600, color: 'text', alpha: a, align: 'center' });
    }
  }
  // three foreground flakes out of focus
  for (let i = 0; i < 3; i++) {
    const x = rand(seed + 3, i, 1) * 1300, y = ((t * 82 + i * 300) % 1180) - 60;
    ctx.text('寂', x, y, { size: 110 + 30 * rand(seed + 3, i, 2), font: 'serif', weight: 600, color: 'text', alpha: 0.13, align: 'center' });
  }
}

/**
 * Frost grows inward from the glass edges as a dot screen; the front advances visibly on every beat, with a bright
 * crystalline rim and needles that lengthen on the beat. `pulse` = the beat envelope from the scene.
 */
export function frostGlass(ctx, t, { at = 0, max = 336, seed = 7, step = 31, pulse = 0 } = {}) {
  const beats = Math.max(0, (t - at) / 0.8);
  // continuous creep + a beat kick: the front is never at rest for a frame, and each beat visibly advances it
  const front = 14 + step * beats + 10 * easeOut(clamp((beats % 1) / 0.38)) + 7 * pulse;
  const edge = (px, py) => Math.min(px, 1920 - px, py, 1080 - py);
  const f = Math.min(max, front);
  dotFill(ctx, FULL, 'ice', {
    density: 0.64, cell: 8, alpha: 0.82, vary: (px, py) => {
      const d = edge(px, py);
      if (d > f) return 0;
      return 0.26 + 0.74 * (1 - d / Math.max(1, f));
    },
  });
  // the front itself: one band of larger, brighter dots so the advance reads on every beat
  dotFill(ctx, FULL, 'ice', {
    density: 0.66, cell: 14, alpha: 0.78, vary: (px, py) => (Math.abs(edge(px, py) - f) < 26 ? 1 : 0),
  });
  // a second, thinner rim just behind it: two dot rows moving together read as one advancing front
  dotFill(ctx, FULL, 'text', {
    density: 0.52, cell: 16, alpha: 0.4, vary: (px, py) => (Math.abs(edge(px, py) - (f - 34)) < 12 ? 1 : 0),
  });
  for (const [x0, y0, x1, y1] of [[0, 4, 1920, 4], [0, 1076, 1920, 1076], [4, 0, 4, 1080], [1916, 0, 1916, 1080]]) ctx.line(x0, y0, x1, y1, { color: 'ice', width: 2, alpha: 0.42 });
  // needles: anchored on the front, lengthening on the beat, so the front itself is always moving
  for (let i = 0; i < 132; i++) {
    const side = i % 4, u = rand(seed, i, 1);
    const d = Math.min(max, front) * (0.62 + 0.36 * rand(seed, i, 2));
    const x = side === 0 ? d : side === 1 ? 1920 - d : u * 1920;
    const y = side === 2 ? d : side === 3 ? 1080 - d : u * 1080;
    const base = 16 + 56 * rand(seed, i, 3), l = base * (0.55 + 0.45 * pulse);
    const a = rand(seed, i, 4) * Math.PI;
    ctx.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, { color: 'ice', width: 1.4 + 0.8 * pulse, alpha: 0.55 });
    ctx.line(x, y, x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, { color: 'text', width: 1.1, alpha: 0.22 });
  }
  // the advancing rim: a few bright grains that slide inward with the front
  for (let i = 0; i < 60; i++) {
    const side = Math.floor(rand(seed + 2, i, 1) * 4), u = rand(seed + 2, i, 2), d = f - 6 - 16 * rand(seed + 2, i, 3);
    const x = side === 0 ? d : side === 1 ? 1920 - d : u * 1920;
    const y = side === 2 ? d : side === 3 ? 1080 - d : u * 1080;
    ctx.circle(x, y, 1.4 + 2.4 * rand(seed + 2, i, 4), { fill: true, color: 'text', alpha: 0.3 + 0.3 * pulse });
  }
}

/** A red square seal stamped on the beat: the characters pressed in vertically, with the impact overshoot. */
export function hanko(ctx, t, { text = 'ふたり', x = 1300, y = 300, at = 0, size = 150, color = 'me', rot = -0.05 } = {}) {
  const k = prog(t, at, at + 0.16);
  if (k <= 0) return;
  const e = easeOut(k), s = 1.32 - 0.32 * e, chars = [...text];
  ctx.at(9, 11, () => ctx.rect(x - size / 2, y - size / 2, size, size, { fill: true, color: 'bg', alpha: 0.45 * e }));
  ctx.at(x, y, () => {
    ctx.rrect(-size / 2, -size / 2, size, size, 7, { fill: color, alpha: 0.94 });
    ctx.rrect(-size / 2 + 8, -size / 2 + 8, size - 16, size - 16, 4, { fill: null, stroke: 'panel', width: 3, alpha: 0.85 });
    const pitch = size * 0.3, y0 = -(chars.length - 1) * pitch / 2 + size * 0.1;
    chars.forEach((ch, i) => ctx.text(ch, 0, y0 + i * pitch, { size: size * 0.3, font: 'serif', weight: 700, color: 'panel', align: 'center', alpha: 0.95 }));
  }, { rot: rot + (1 - e) * 0.1, scale: s });
  dotLight(ctx, x, y + size * 0.6, 140, color, { alpha: 0.2 * (1 - e), cell: 9 });
}

/** The answering machine read-out at the bottom left: REC lamp, tape direction, running counter. */
export function recPanel(ctx, t, { x = 70, y = 830, counter = 0, alpha = 1, label = 'REC' } = {}) {
  const w = 470, h = 168, blink = 0.62 + 0.38 * Math.sin(t * 7.2);
  ctx.rect(x, y, w, h, { fill: true, color: 'panel', alpha: 0.9 * alpha });
  ctx.rect(x, y, w, h, { color: 'line', alpha: 0.9 * alpha, width: 2 });
  ctx.line(x + 22, y + 46, x + w - 22, y + 46, { color: 'line', alpha: 0.6 * alpha, width: 1 });
  ctx.circle(x + 34, y + 26, 9, { fill: true, color: 'err', alpha: alpha * blink });
  if (alpha > 0.1) ctx.glow('err', 22, () => ctx.circle(x + 34, y + 26, 8, { fill: true, color: 'err', alpha: alpha * blink }), alpha * blink);
  ctx.text(label, x + 56, y + 34, { size: 24, font: 'mono', weight: 700, color: 'text', alpha });
  ctx.text('TAPE', x + w - 26, y + 34, { size: 15, font: 'mono', color: 'mute', align: 'right', alpha });
  ctx.poly([[x + 22, y + 82], [x + 44, y + 94], [x + 22, y + 106]], { fill: true, color: 'text', alpha: alpha * 0.85, close: true });
  ctx.text('COUNTER', x + 24, y + 126, { size: 15, font: 'mono', color: 'mute', alpha });
  ctx.text(String(Math.max(0, Math.floor(counter)) % 1000).padStart(3, '0'), x + w - 26, y + 130, { size: 62, font: 'mono', color: 'text', align: 'right', alpha });
}

/** The 度数 LED as a printed little panel in a corner. */
export function unitsPanel(ctx, t, { x = 130, y = 800, units = 50, scale = 1, alpha = 1, pulseK = 0 } = {}) {
  ctx.at(x, y, () => {
    ctx.rect(0, 0, 300, 170, { fill: true, color: 'panel', alpha: 0.9 * alpha });
    ctx.rect(0, 0, 300, 170, { color: 'line', width: 2, alpha: 0.9 * alpha });
    ctx.text('度数', 54, 40, { size: 22, font: 'sans', weight: 700, color: 'text', alpha: alpha * 0.9 });
    ctx.text('UNITS', 280, 30, { size: 13, font: 'mono', color: 'mute', align: 'right', alpha });
    ctx.rrect(18, 58, 264, 92, 6, { fill: 'panel', alpha });
    ctx.rrect(26, 66, 248, 76, 4, { fill: 'errDim', alpha: alpha * 0.3 });
    if (pulseK > 0.01) ctx.glow('err', 26, () => ctx.rect(26, 66, 248, 76, { fill: true, color: 'err', alpha: alpha * 0.16 * pulseK }));
    ctx.text(String(units).padStart(3, '0'), 152, 142, { size: 70, font: 'mono', weight: 700, color: 'err', align: 'center', alpha });
  }, { scale });
}
