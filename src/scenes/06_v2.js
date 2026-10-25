// V2 (186.61 - 212.21): she has left the booth. On the same street an electronics shop's window is full of TVs, all
// showing her on a festival stage, cheered by a crowd - and she stands outside in the snow, alone: nobody on the
// street knows her. Over her shoulder, the TV shows her own smile for everyone. She goes back to the booth and dials.
// (A "stranger who looks like him" was tried and cut on review: it did not belong to the song and read as Touya.)
// docs/STORYBOARD_v2.md §1 V2 + v2.1 (geography: one street; the TVs never "answer" her). Lyrics: the right column.
//
// Beat map (node tools/beatmap.mjs 186.5 213.2):
//  186.61  BAR 58    CUT: the street, night: she has come out of the booth and walks away down it (y_walk, leftwards)  night
//  189.81  BAR 59    CUT (の 189.87): the shop window, wide: every TV shows her on stage; passers-by cross in front    tv
//  193.01  BAR 60    CUT (微 193.03): one TV close: her singing, reaching out to the audience
//  196.21  BAR 61    CUT (く 196.66): another TV: the audience waving glow sticks
//  199.41  BAR 62    CUT (だ 199.42): the window again, wider, the passers-by
//  200.21  beat 250  CUT (な 200.37): pull back: she stands small in the snow before the bright window, her back to us;
//                    the people pass her both ways and nobody looks - on the screens thousands cheer her
//  205.81  BAR 64    CUT (気 205.79): over her shoulder: a TV beyond the glass shows her stage smile, close; push in
//  209.81  beat 262  CUT: the lit booth far down the street; she walks back to it
//  211.41  beat 264  CUT: the keys: she dials again, fast; the ringback (sound) runs into B2 (212.21)
import { cues } from './cues.js';
import { charTimes } from './kit.js';
import { fig, fit, backdrop, plateAt } from './stage.js';
import { panelAt, ledDigits, PANEL, KEYPOS } from './props.js';
import { PL as STREET, W as SW } from './02_v1.js';
import { snow } from '../components/world.js';
import { dotLight, dotCone, drift, nearSnow } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

// the TV screens in bg_tv_shop (u0, v0, u1, v1 in 0..1 of the plate; measured), the two big ones first
const TVS = [[0.4378, 0.3549, 0.5066, 0.4463], [0.439, 0.5175, 0.5126, 0.6291], [0.5604, 0.4113, 0.6196, 0.4899], [0.5789, 0.559, 0.6274, 0.6376],
  [0.7051, 0.4102, 0.7542, 0.4772], [0.6854, 0.5792, 0.7309, 0.6419], [0.3684, 0.4017, 0.4103, 0.4633], [0.3702, 0.56, 0.4157, 0.6323],
  [0.5843, 0.3199, 0.6316, 0.3762], [0.6699, 0.3146, 0.7004, 0.373]];
// passers-by: each figure's box in its picture (source px of the plate)
const PA = [[236, 120, 956, 1601], [1346, 218, 773, 1505], [2280, 204, 859, 1517]];   // passers_a: salaryman, woman, old man (they FACE LEFT)
const PB = [[198, 208, 793, 1351], [1202, 48, 1175, 1509], [2670, 146, 1113, 1408]];  // passers_b: student, couple, mother + child (facing right)
const PRESS_TIP = [0.207, 0.794];                                                     // h_press_hand fingertip (as 01_intro)

export function v2Shots(env) {
  const { B, Bt, P } = cues(env);
  const at = (line, ch, nth = 0) => { let n = 0; for (const c of charTimes(env, line)) if (c.c === ch && n++ === nth) return c.t; return null; };
  const tKie = at(14, '消');

  /** What a TV is showing at time t, drawn into rect r: her on stage (big screens) or the audience (small ones). */
  const tvPicture = (ctx, t, r, k, { close = false } = {}) => {
    ctx.clip(r, () => {
      ctx.rect(r.x, r.y, r.w, r.h, { fill: true, color: 'panel' });
      const her = close ? k === 0 : k < 2 || k % 3 === 0;
      if (her) {
        dotCone(ctx, [r.x + r.w * 0.5, r.y - r.h * 0.1], [r.x + r.w * 0.5, r.y + r.h], r.w * 0.6, 'text', { alpha: 0.55, cell: Math.max(4, r.w / 40), w0: r.w * 0.1 });
        const fr = Math.floor((t + k * 0.37) / 0.6) % 2, h = r.h * 1.25;
        fig(ctx, env, `y_stage_${fr}`, fit(env, 'y_stage_0', r.x + r.w * 0.5, r.y + r.h * 1.15, h), t, { seed: 140 + k, breathe: 0 });
      } else {
        const sz = env.plates.size('crowd_concert'), w = r.w * 1.15, h = (w * sz.h) / sz.w, bob = Math.sin(t * 7 + k) * r.h * 0.02;
        fig(ctx, env, 'crowd_concert', { x: r.x - r.w * 0.075, y: r.y + r.h - h * 0.9 + bob, w, h }, t, { shadow: false });
      }
      for (let y = r.y; y < r.y + r.h; y += Math.max(2, r.h / 60)) ctx.line(r.x, y, r.x + r.w, y, { color: 'panel', alpha: 0.25, width: 1 });   // scanlines
      ctx.rect(r.x, r.y, r.w, r.h, { fill: true, color: 'ice', alpha: 0.05 + 0.04 * Math.sin(t * 31 + k) });                                // flicker
    });
  };
  const shopWindow = (ctx, t, opt) => {
    backdrop(ctx, env, 'bg_tv_shop', opt);
    TVS.forEach((s, k) => {
      const [x0, y0] = plateAt(env, 'bg_tv_shop', s[0], s[1], opt), [x1, y1] = plateAt(env, 'bg_tv_shop', s[2], s[3], opt);
      tvPicture(ctx, t, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, k);
      dotLight(ctx, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * 1.1, 'bloom', { alpha: 0.18, cell: 8 });
    });
  };
  /** Passers-by crossing the frame at ground line y: [box, picture, speed px/s, start x, height, flip]. */
  const crowd = (ctx, t, t0, y, list) => {
    for (const [box, name, v, x0, h, flip] of list) {
      const x = x0 + v * (t - t0), bob = -Math.abs(Math.sin((t - t0) * 6 + x0)) * h * 0.012;
      fig(ctx, env, name, fit(env, name, x, y + bob, h, { w: box[2], h: box[3] }), t, { crop: { x: box[0], y: box[1], w: box[2], h: box[3] }, flip, shadow: false });
    }
  };

  return [
    {
      id: 'v2-leave', at: B(58), palette: 'night',
      moment: 'The line is dead. She has come out of the booth and walks away down the snowy street.',
      layout: 'the intro street; the booth lit on the right; her small, walking away to the left',
      camera: (t) => { const d = drift(t, 131, 4), k = easeInOut(prog(t, B(58), B(59))); return { x: d.x + 160 - 120 * k, y: d.y, zoom: 1.12, rot: d.rot }; },
      render(ctx, t, f, u) {
        env.plates.draw(ctx, 'bg_street_night', STREET);
        const k = prog(t, B(58), B(59)), [bx] = SW(0.83, 0.8), x = lerp(bx - 80, bx - 760, k), y = lerp(1000, 940, k), h = lerp(470, 400, k);
        fig(ctx, env, `y_walk_${Math.floor((t - B(58)) / (P / 4)) % 4}`, fit(env, 'y_walk_0', x, y, h), t, { flip: true, seed: 132, roles: { cream: 'sub', orange: 'me', black: 'bg' }, breathe: 0 });
        snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 230, seed: 133 });
        nearSnow(ctx, t, { count: 5, seed: 134, alpha: 0.12 });
      },
    },
    {
      id: 'v2-window', at: B(59), palette: 'tv',
      moment: 'The electronics shop on the same street: every TV in its window shows her, singing on a festival stage. People hurry past.',
      layout: 'the shop window wide; the TVs glowing; passers-by crossing in front both ways',
      camera: (t) => { const d = drift(t, 135, 4), k = easeInOut(prog(t, B(59), B(60))); return { x: d.x - 40 + 80 * k, y: d.y, zoom: 1.05 + 0.04 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        shopWindow(ctx, t, { focus: [0.52, 0.48], zoom: 1.0 });
        crowd(ctx, t, B(59), 1150, [[PA[0], 'passers_a', -260, 1500, 620, false], [PB[1], 'passers_b', 210, -200, 600, false], [PA[1], 'passers_a', -200, 2300, 560, false]]);
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 160, seed: 136 });
      },
    },
    ...[[B(60), 0, 'one TV close: her on the stage, reaching out to the crowd'], [B(61), 1, 'another TV close: the crowd waving glow sticks to her']].map(([cut, k, layout]) => ({
      id: `v2-tv${k}`, at: cut, palette: 'tv',
      moment: 'So many people share their smiles with her.',
      layout,
      camera: (t) => { const d = drift(t, 137 + k, 3), kk = easeInOut(prog(t, cut, cut + 3.2)); return { x: d.x, y: d.y, zoom: 1.0 + 0.06 * kk, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        const r = { x: 250, y: 60, w: 1180, h: 920 };
        ctx.rrect(r.x - 40, r.y - 40, r.w + 80, r.h + 80, 30, { fill: 'raised' });                  // the set's frame
        tvPicture(ctx, t, r, k, { close: true });
        dotLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8, 'bloom', { alpha: 0.12, cell: 12 });
      },
    })),
    {
      id: 'v2-window2', at: B(62), palette: 'tv',
      moment: 'The window again: the crowd on the screens, the people on the pavement.',
      layout: 'the shop window, wider, passers-by',
      camera: (t) => { const d = drift(t, 139, 3); return { x: d.x + 40, y: d.y, zoom: 1.02, rot: d.rot }; },
      render(ctx, t, f, u) {
        shopWindow(ctx, t, { focus: [0.5, 0.5], zoom: 1.0 });
        crowd(ctx, t, B(62), 1150, [[PB[2], 'passers_b', 240, -300, 620, false], [PA[2], 'passers_a', -180, 1700, 600, false]]);
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 160, seed: 140 });
      },
    },
    {
      id: 'v2-alone', at: Bt(250), palette: 'tv',
      moment: 'And yet she feels alone: small in the snow before the bright window, her back to us. The people pass her both ways and nobody looks - on every screen a crowd cheers her.',
      layout: 'pulled back: the window bright behind; her small in the middle, looking at the TVs; passers-by streaming past both ways',
      camera: (t) => { const d = drift(t, 141, 3), k = easeInOut(prog(t, Bt(250), B(64))); return { x: d.x, y: d.y, zoom: 1.0 + 0.1 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        shopWindow(ctx, t, { focus: [0.5, 0.45], zoom: 0.92 });
        fig(ctx, env, 'y_stop_back', fit(env, 'y_stop_back', 900, 1060, 480), t, { at: u.at, seed: 142 });
        crowd(ctx, t, Bt(250), 1100, [[PA[0], 'passers_a', -170, 1700, 560, false], [PB[1], 'passers_b', 150, -500, 540, false], [PB[0], 'passers_b', 170, 200, 520, false], [PA[1], 'passers_a', -190, 2500, 540, false]]);
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 200, seed: 143 });
        nearSnow(ctx, t, { count: 4, seed: 144, alpha: 0.12 });
      },
    },
    {
      id: 'v2-self', at: B(64), palette: 'tv',
      moment: 'The feeling will not go away: over her shoulder, a TV beyond the glass shows her own stage smile, close - the one she gives everyone.',
      layout: 'her hair and shoulder dark and out of focus in the foreground left; one TV right of centre, her singing on it; push in to the screen',
      camera: (t) => { const d = drift(t, 145, 3), k = easeInOut(prog(t, B(64), Bt(262))); return { x: d.x + 120 * k, y: d.y - 20 * k, zoom: 1.0 + 0.18 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_tv_shop', { focus: [0.62, 0.45], zoom: 2.2, blur: 6 });
        const r = { x: 860, y: 230, w: 700, h: 540 };
        ctx.rrect(r.x - 26, r.y - 26, r.w + 52, r.h + 52, 22, { fill: 'raised' });
        tvPicture(ctx, t, r, 0, { close: true });
        dotLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.9, 'bloom', { alpha: 0.14, cell: 11 });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 120, seed: 147, size: 4 });
        // her, in the foreground: the back of her head and shoulder, dark against the glow, out of focus
        const g = ctx.g, sz = env.art.size('y_stop_back'), crop = { x: 0, y: 0, w: sz.w, h: 0.42 * sz.h }, h = 1300, w = (h * crop.w) / crop.h;
        g.save(); g.filter = `blur(${5 * ctx.scale}px)`;
        fig(ctx, env, 'y_stop_back', { x: -260, y: 1140 - h, w, h }, t, { at: u.at, seed: 146, crop, roles: { cream: 'panel', orange: 'me', black: 'panel' }, breathe: 0 });   // a dark silhouette, only her hair keeps its colour
        g.restore(); ctx._font = '';
      },
    },
    {
      id: 'v2-back', at: Bt(262), palette: 'night',
      moment: 'She goes back to the booth, the only lit box down the street.',
      layout: 'the street; the booth lit on the right; her walking towards it',
      camera: (t) => { const d = drift(t, 151, 3), k = easeInOut(prog(t, Bt(262), Bt(264))); return { x: d.x + 200 + 60 * k, y: d.y, zoom: 1.15 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        env.plates.draw(ctx, 'bg_street_night', STREET);
        const k = prog(t, Bt(262), Bt(264)), [bx] = SW(0.83, 0.8), x = lerp(bx - 900, bx - 520, k);
        fig(ctx, env, `y_walk_${Math.floor((t - Bt(262)) / (P / 4)) % 4}`, fit(env, 'y_walk_0', x, 990, 440), t, { seed: 152, roles: { cream: 'sub', orange: 'me', black: 'bg' }, breathe: 0 });
        snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 230, seed: 153 });
      },
    },
    {
      id: 'v2-dial', at: Bt(264), palette: 'night',
      moment: 'She dials his number again, fast.',
      layout: 'the keys close, her finger pressing three keys in a row; the LED shows 19',
      camera: (t) => { const d = drift(t, 154, 3); return { x: d.x, y: d.y, zoom: 1.02, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.28, cell: 13 });
        const Pn = panelAt(0.562, 0.36, 820, 520, 3000);
        fig(ctx, env, 'obj_phone_panel', Pn.d, t, { at: u.at, seed: 155 });
        ledDigits(ctx, Pn, 19);
        const digits = '986', i = Math.min(2, Math.floor((t - Bt(264)) / (P / 4))), since = t - Bt(264) - i * (P / 4);
        const [kc, kr] = KEYPOS[digits[i]], [kx, ky] = Pn.at(...PANEL.key(kc, kr)), kw = PANEL.keyW * Pn.d.w, down = since < 0.1 ? 1 : 1 - easeOut(clamp((since - 0.1) / 0.1));
        ctx.rect(kx - kw / 2, ky - kw / 2, kw, kw, { fill: true, color: 'bg', alpha: 0.4 * down });
        const hw = 11 * kw, hh = (hw * 941) / 1672, lift = (1 - down) * 0.5 * kw;
        fig(ctx, env, 'h_press_hand', { x: kx - PRESS_TIP[0] * hw + 0.6 * lift, y: ky - PRESS_TIP[1] * hh - lift, w: hw, h: hh }, t, { seed: 156, breathe: 0 });
      },
    },
  ];
}

export function v2Sfx(env) {
  const { B, Bt, P } = cues(env);
  const ev = [];
  for (let ts = B(58) + 0.1; ts < B(59) - 0.2; ts += P / 2) ev.push({ t: ts, kind: 'step', rel: -16, pan: 0.3 });   // her steps in the snow
  ev.push({ t: B(59), kind: 'crowd', dur: B(65) + 2.4 - B(59), rel: -26 });                                     // the street, the shop
  '986'.split('').forEach((d, i) => ev.push({ t: Bt(264) + i * (P / 4), kind: 'dtmf', key: d, rel: -15 }, { t: Bt(264) + i * (P / 4), kind: 'key', rel: -13 }));
  ev.push({ t: B(66) - 0.1, kind: 'ringback', rel: -18 });                                                     // into B2
  return ev;
}
export const TV_SCREENS = TVS;   // (used by 09_bridge.js)
