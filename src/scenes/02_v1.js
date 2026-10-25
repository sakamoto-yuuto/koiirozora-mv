// V1 (74.61 - 101.01): she begins to speak to his machine, and what she says is a memory: the same street at dusk,
// the two of them walking away hand in hand; back in the booth she smiles; his room in warm light, the table
// emptying until only their two mugs are left. docs/STORYBOARD_v2.md §1 V1 + v2.1.
// Lyrics: the shared right column; 黄昏 is a hero word (on the lightbox of the street, blank in the column).
//
// Beat map (node tools/beatmap.mjs 74.5 101.3):
//   75.41  beat 94   CUT: the street of the intro, night, same camera                                   night
//   75.63  L0 黄     the lightbox lights 黄; the night street turns to dusk through a growing dot screen  > memory
//   76.35     昏     昏 lights under it; the dusk is complete
//   ~76.4            the two of them walk in from the bottom of the frame, away from us (one step per half beat)
//   80.92  L1 ふ
//   81.01  BAR 25    CUT: their joined hands from behind, bobbing with each step                          memory
//   84.21  BAR 26 い CUT: the two of them, full figure from behind, the street drawing past them
//   87.81  beat 108.5 CUT (る 87.42 · こ 88.10): the booth, her profile, eyes closed; the LED counts her units   voice
//   90.14     傍     the faint smile (y_smile 1)
//   93.81  BAR 29    CUT (も 93.65): his room in warm memory light, the low table with their things          memory
//   94.46 う · 95.39 何 · 97.08 も · 98.57 ら   one thing leaves the table on each: gloves, magazine, cassette, keys
//  100.08     な     only the two mugs are left, their steam leaning together
//  101.01  L4 夢     (next section)
import { cues } from './cues.js';
import { charTimes, heroChars } from './kit.js';
import { fig, fit, backdrop, plateAt } from './stage.js';
import { panelAt, ledDigits, units, boothInside } from './props.js';
import { snow } from '../components/world.js';
import { dotLight, dotRing, drift, nearSnow } from '../components/print.js';
import { clamp, easeInOut, easeOut, lerp, prog } from '../engine/util.js';

export const PL = { x: -100, y: -60, w: 2100, h: (2100 * 1880) / 3344 };   // the street plate, placed as in the intro
export const W = (u, v) => [PL.x + u * PL.w, PL.y + v * PL.h];
const LIGHTBOX = { u0: 0.1794, u1: 0.2033, v0: 0.170, v1: 0.319 };          // the blank vertical sign, left (bg_street_dusk)
export const VP = [0.478, 0.616];                                            // where the street vanishes
// bg_his_room_warm: the low table top, corners in source px of the 1672 x 941 picture
const TABLE = { fl: [545, 636], fr: [1000, 660], bl: [595, 602], br: [1120, 622], W: 1672, H: 941 };
export const MUG_CM = 16;                                                 // the width of a mug picture on his table, both rooms (cm)
export const tableUV = (a, b) => {                                       // (the same room in the dark: bg_his_room_night)
  const f = [lerp(TABLE.fl[0], TABLE.fr[0], a), lerp(TABLE.fl[1], TABLE.fr[1], a)], k = [lerp(TABLE.bl[0], TABLE.br[0], a), lerp(TABLE.bl[1], TABLE.br[1], a)];
  return [lerp(f[0], k[0], b) / TABLE.W, lerp(f[1], k[1], b) / TABLE.H];
};

export function v1Shots(env) {
  const { B, Bt, P } = cues(env);
  const hero = heroChars(env, 0);                                            // 黄 昏 with their sung times
  const tH = hero[0].t, tK = hero[1].t;
  const l3 = charTimes(env, 3);                                              // 〔L4〕
  const at = (ch, nth = 0) => { let n = 0; for (const c of l3) if (c.c === ch && n++ === nth) return c.t; return null; };
  const step = (t, t0) => Math.floor((t - t0) / (P / 4)) % 4;              // walk drawings: one step per half beat, 4 drawings per two steps

  // the night street turns to dusk: a dot screen of the dusk plate grows from the lightbox outwards
  const duskK = (t) => prog(t, tH, tK + 0.45);
  const dotWipe = (ctx, k, [ox, oy]) => {
    const cell = 28, g = ctx.g;
    g.fillStyle = '#fff'; g.beginPath();
    for (let y = -60; y < 1140; y += cell) for (let x = -120 + ((y / cell) % 2) * cell / 2; x < 2060; x += cell) {
      const d = Math.hypot(x - ox, y - oy) / 2200, r = cell * 0.78 * clamp(k * 1.9 - d * 1.2);
      if (r > 0.4) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832); }
    }
    g.fill();
  };
  const lightbox = (ctx, t, k) => {
    const [x0, y0] = W(LIGHTBOX.u0, LIGHTBOX.v0), [x1, y1] = W(LIGHTBOX.u1, LIGHTBOX.v1), w = x1 - x0, h = y1 - y0;
    const on = easeOut(clamp((t - tH) / 0.18));
    if (on <= 0) return;
    dotLight(ctx, (x0 + x1) / 2, (y0 + y1) / 2, 2.6 * h, 'youHot', { alpha: 0.5 * on, cell: 9, sy: 1.1 });
    ctx.rrect(x0, y0, w, h, w * 0.28, { fill: 'youHot', alpha: on, fillAlpha: 0.95 });
    hero.forEach((c, i) => {                                                  // 黄 / 昏, each when it is sung, printed dark on the light
      const e = easeOut(clamp((t - c.t) / 0.18)), sz = w * 0.74;
      if (e > 0) ctx.text(c.c, (x0 + x1) / 2, y0 + h * (0.12 + 0.44 * i) + sz * 0.9 - (1 - e) * 4, { size: sz, font: 'serif', weight: 700, color: 'bg', alpha: e, align: 'center' });
    });
  };

  return [
    {
      id: 'v1-dusk', at: Bt(94), palette: (t) => (duskK(t) < 0.5 ? 'night' : 'memory'), state: 'night > memory (黄, the dot screen)',
      moment: 'She begins to speak - and what she says is a memory: the same street, at dusk, the two of them walking away hand in hand. 黄昏 lights on the street sign.',
      layout: 'the intro street, same camera; the lightbox upper left; the two of them small, walking away down the middle of the street',
      camera: (t) => { const d = drift(t, 41, 5), k = easeInOut(prog(t, Bt(94), B(25))); return { x: d.x - 60 + 60 * k, y: d.y - 40 + 30 * k, zoom: 1.22 + 0.12 * k, rot: d.rot }; },   // -60: the blank shop sign on the right stays ~120 px left of the lyric column for the whole push (never under a character)
      render(ctx, t) {
        const k = duskK(t);
        ctx.withPal('night', () => env.plates.draw(ctx, 'bg_street_night', PL));
        if (k > 0) ctx.masked(() => ctx.withPal('memory', () => env.plates.draw(ctx, 'bg_street_dusk', PL)), () => dotWipe(ctx, k, W((LIGHTBOX.u0 + LIGHTBOX.u1) / 2, (LIGHTBOX.v0 + LIGHTBOX.v1) / 2)));
        ctx.withPal(k < 0.5 ? 'night' : 'memory', () => lightbox(ctx, t, k));
        // the two of them, walking away: distance grows linearly, so the size shrinks as 1 / distance
        const t0 = tK + 0.1;
        if (t >= t0) {
          // they come from behind the camera (first only their backs, big, cut by the frame) and walk away
          const d = 0.8 + 2.8 * prog(t, t0, B(25) + 0.3), [vx, vy] = W(VP[0], VP[1]);
          const x = vx + (820 - vx) / d, y = vy + (1290 - vy) / d, h = 1080 / d;
          fig(ctx, env, `yt_walk_back_${step(t, t0)}`, fit(env, 'yt_walk_back_0', x, y, h), t, { seed: 43, shadow: false });
        }
        if (k < 1) snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 160, seed: 1, alpha: 0.9 * (1 - k) });   // the night's snow stops with the memory
        nearSnow(ctx, t, { count: 3, seed: 45, alpha: 0.08 * (1 - k) });
      },
    },
    {
      id: 'v1-hands', at: B(25), palette: 'memory',
      moment: 'Their joined hands from behind - her knitted glove in his hand - swinging a little with each step.',
      layout: 'close on the joined hands between the two coats; the dusk street out of focus ahead of them',
      camera: (t) => { const d = drift(t, 47, 4), k = easeInOut(prog(t, B(25), B(26))); return { x: d.x - 70 + 140 * k, y: d.y, zoom: 1.04 + 0.04 * k, rot: d.rot }; },   // we walk beside them, slowly overtaking
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_street_dusk', { focus: [0.47, 0.72], zoom: 2.3 + 0.12 * prog(t, B(25), B(26)), blur: 12 });
        const ph = ((t - B(25)) / (P / 2)) % 1, bob = -14 * Math.abs(Math.sin(ph * Math.PI)), sway = 6 * Math.sin(((t - B(25)) / P) * Math.PI * 2);
        const crop = { x: 530, y: 1560, w: 1100, h: 620 }, w = 2160, h = (w * crop.h) / crop.w;
        ctx.at(960 + sway, 540 + bob, () => fig(ctx, env, 'yt_hands_back', { x: -w / 2, y: -h / 2, w, h }, t, { at: u.at, seed: 48, crop }), { rot: 0.012 * Math.sin(((t - B(25)) / P) * Math.PI * 2) });
      },
    },
    {
      id: 'v1-pair', at: B(26), palette: 'memory',
      moment: 'The two of them walking together down the dusk street, seen from behind.',
      layout: 'the pair centred, full figures; the street ahead pushing slowly towards us as they walk into it',
      camera: (t) => { const d = drift(t, 49, 5); return { x: d.x, y: d.y, zoom: 1.0, rot: d.rot }; },
      render(ctx, t, f, u) {
        const k = prog(t, B(26), Bt(108.5));
        backdrop(ctx, env, 'bg_street_dusk', { focus: [0.45, 0.6], zoom: 1.35 + 0.18 * k, blur: 2.5 });
        fig(ctx, env, `yt_walk_back_${step(t, B(26))}`, fit(env, 'yt_walk_back_0', 930, 1110, 960), t, { at: u.at, seed: 50, shadow: false });
      },
    },
    {
      id: 'v1-smile', at: Bt(108.5), palette: 'voice',
      moment: 'Back in the booth, eyes closed, she smiles at the thought of staying by his side. The little LED counts her units down.',
      layout: 'her profile right of centre facing the phone at the left edge; the LED window visible; slow push in',
      camera: (t) => { const d = drift(t, 51, 4), k = easeInOut(prog(t, Bt(108.5), B(29))); return { x: d.x - 60 + 300 * k, y: d.y - 20 + 60 * k, zoom: 1.0 + 0.2 * k, rot: d.rot }; },   // from the phone and its LED to her smiling face
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.62, 0.48], fogK: 0.55 });
        const Pn = panelAt(0.56, 0.24, 300, 330, 1500);
        fig(ctx, env, 'obj_phone_panel', Pn.d, t, { at: u.at, seed: 52 });
        ledDigits(ctx, Pn, units(env, t));
        const smile = t >= heroAt(env, 2, '傍') ? 1 : 0;
        fig(ctx, env, `y_smile_${smile}`, fit(env, 'y_smile_0', 1190, 1110, 1060), t, { at: u.at, seed: 53 });
      },
    },
    {
      id: 'v1-table', at: B(29), palette: 'memory',
      moment: 'His room, in the warm light of a memory. Their things on the low table leave one by one, until only their two mugs are left: nothing else is needed.',
      layout: 'the low table centred, close; the lamp light pooling on it; slow push in',
      camera: (t) => { const d = drift(t, 53, 4); return { x: d.x, y: d.y, zoom: 1, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.655], zoom: 2.05 + 0.25 * easeInOut(prog(t, B(29), 101.01)) };
        backdrop(ctx, env, 'bg_his_room_warm', opt);
        const things = [                                                     // [name, a (left - right), b (front - back), width of the PICTURE in cm (steam, shadow and margin included), leaves on]
          ['o2_keys', 0.74, 0.14, 12, at('ら')],
          ['o2_cassette', 0.84, 0.58, 20, at('も', 1)],
          ['o2_magazine', 0.17, 0.72, 31, at('何')],
          ['o2_mug_cream', 0.45, 0.5, MUG_CM, null],
          ['o2_mug_amber', 0.59, 0.5, MUG_CM, null],
          ['o2_gloves', 0.2, 0.16, 22, at('う')],
        ].sort((p, q) => q[2] - p[2]);                                       // far first
        for (const [name, a, b, cm, tOut] of things) {
          const [uu, vv] = tableUV(a, b), [x, y, s] = plateAt(env, 'bg_his_room_warm', uu, vv, opt);
          const sz = env.plates.size(name), w = cm * 9.2 * s, h = (w * sz.h) / sz.w, gone = tOut == null ? 0 : prog(t, tOut, tOut + 0.3);
          if (gone >= 1) continue;
          fig(ctx, env, name, { x: x - w / 2, y: y - h * 0.92 - 10 * gone, w, h }, t, { at: u.at, seed: 55, alpha: 1 - easeOut(gone) });
          if (gone > 0) dotRing(ctx, x, y - h * 0.4, 20 + 90 * gone, 10, 'youHot', { alpha: 0.5 * (1 - gone), cell: 8 });
        }
        // na: only the two of them are left; the lamp gathers on the two mugs
        const kNa = easeOut(prog(t, at('な'), at('な') + 0.8));
        if (kNa > 0) { const [uu, vv] = tableUV(0.5, 0.5), [x, y] = plateAt(env, 'bg_his_room_warm', uu, vv, opt); dotLight(ctx, x, y - 60, 420, 'youHot', { alpha: 0.35 * kNa, cell: 10, sy: 0.6 }); }
      },
    },
  ];
}

/** Time of the first `ch` in lyric line i. */
function heroAt(env, i, ch) { const c = charTimes(env, i).find((x) => x.c === ch); return c ? c.t : Infinity; }

export function v1Sfx() { return []; }        // a memory: the music alone
