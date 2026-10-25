// B1 (101.01 - 122.61): the dream time passes; every goodbye on the platform; she almost cries.
// docs/STORYBOARD_v2.md §1 B1 + v2.1. Lyrics: the shared right column (no hero word in B1).
//
// Beat map (node tools/beatmap.mjs 101 123):
//  101.01  L4 夢      CUT: the same street, locked off: a time-lapse. Dusk sinks into night through a dot screen        memory > night
//  103.41  BAR 32     the street's lights start to come on, a few on every half beat (50 of them, data: lights_street.js)
//  107.65     過      the two of them, far down the street, are gone by て (108.72); the night's snow returns
//  110.61  beat 138   CUT (「 110.95): inside a train at night: the back of his head in the dark car; through the window
//                     she stands on the platform and waves (y_wave 0-1-2-1)                                             memory
//  113.81  beat 142   (手を) the train moves: the platform, and she, slide away to the left, faster and faster, blurred
//  116.29     に      she is gone; only the platform lamps stream past
//  117.01  beat 146   CUT (泣 117.32): her eye, close, in the booth: dry; そ 117.86 a tear wells; に 119.84 it runs  voice
//  121.01  beat 151   CUT: her clenched hand at her chest, eyes closed
//  122.61  BAR 38     (next section: C1, 心 122.82)
import { cues } from './cues.js';
import { charTimes } from './kit.js';
import { fig, fit, backdrop } from './stage.js';
import { boothInside } from './props.js';
import { PL, W, VP } from './02_v1.js';
import { STREET_LIGHTS } from './lights_street.js';
import { snow } from '../components/world.js';
import { dotLight, dotFill, drift, nearSnow } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeIn, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

export function b1Shots(env) {
  const { B, Bt, P } = cues(env);
  const at = (line, ch, nth = 0) => { let n = 0; for (const c of charTimes(env, line)) if (c.c === ch && n++ === nth) return c.t; return null; };
  const tSugi = at(4, '過'), tTe = at(4, 'て'), tSoU = at(6, 'そ'), tNi6 = at(6, 'に');
  const step = (t, t0) => Math.floor((t - t0) / (P / 4)) % 4;

  // ---- the time-lapse -----------------------------------------------------------------------------------------------
  const T0 = 101.01, NIGHT = (t) => prog(t, T0 + 0.3, B(33) + 0.4);       // linear: the night comes down from the sky over ~6 s
  // each light comes on on a half beat between bar 32 and bar 34, in a fixed shuffled order (the big ones a little first)
  const LIGHT_ON = STREET_LIGHTS.map((b, i) => ({ b, on: B(32) + Math.floor((0.65 * (i / STREET_LIGHTS.length) + 0.35 * rand(91, i)) * 13) * (P / 2) }));
  const nightWipe = (ctx, k) => {                                            // the night comes down from the sky: a dot screen
    const cell = 26, g = ctx.g;
    g.fillStyle = '#fff'; g.beginPath();
    for (let y = -60; y < 1140; y += cell) for (let x = -120 + ((y / cell) % 2) * cell / 2; x < 2060; x += cell) {
      const r = cell * 0.78 * clamp(k * 1.8 - (y + 60) / 1200 * 0.8);
      if (r > 0.4) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832); }
    }
    g.fill();
  };

  // ---- the train: outside slides left, faster and faster --------------------------------------------------------------
  const DEPART = Bt(142);
  const outsideX = (t) => -280 * Math.pow(Math.max(0, t - DEPART), 2);    // px; ~ -1600 by 116.2
  const waveFrame = (t) => [0, 1, 2, 1][Math.floor((t - Bt(138)) / 0.14) % 4];

  return [
    {
      id: 'b1-timelapse', at: T0, palette: (t) => ['memory', 'night', NIGHT(t)], state: 'memory > night (the time-lapse)',
      moment: 'The dream time passes: on the same street the dusk sinks into night, the lights come on one by one, and the two of them walk on until they are gone.',
      layout: 'the street, locked off as in V1 (the shop sign clear of the column); lights switching on over the whole plate',
      camera: (t) => { const d = drift(t, 61, 3), k = easeInOut(prog(t, T0, Bt(138))); return { x: d.x - 60 + 40 * k, y: d.y - 20 + 25 * k, zoom: 1.26 + 0.3 * k, rot: d.rot * 0.5 }; },   // a slow push down the street the whole time
      render(ctx, t) {
        const k = NIGHT(t);
        ctx.withPal('memory', () => env.plates.draw(ctx, 'bg_street_dusk', PL));
        if (k > 0) ctx.masked(() => ctx.withPal('night', () => env.plates.draw(ctx, 'bg_street_night', PL, { roles: { youHot: 'panel' } })), () => nightWipe(ctx, k));
        // the lights: each one switched on in its own box; the small rest together at the end
        ctx.withPal('night', () => {
          for (const L of LIGHT_ON) {
            if (t < L.on) continue;
            const [x0, y0] = W(L.b[0], L.b[1]), [x1, y1] = W(L.b[2], L.b[3]), flick = t - L.on < 0.12 ? (rand(93, Math.floor(t * 40)) > 0.5 ? 1 : 0.3) : 1;
            // lit = the brightest ink of the film (in the night state the amber role is a grey: it would not read as light)
            const r = Math.max(x1 - x0, y1 - y0), p = pulse(t - L.on, 4);
            dotLight(ctx, (x0 + x1) / 2, (y0 + y1) / 2, 24 + 1.1 * r, 'bloom', { alpha: 0.22 + 0.4 * p, cell: 8 });
            ctx.clip({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, () => env.plates.draw(ctx, 'bg_street_night', PL, { only: ['youHot'], roles: { youHot: 'text' }, alpha: flick }));
          }
          if (t > Bt(137)) env.plates.draw(ctx, 'bg_street_night', PL, { only: ['youHot'], roles: { youHot: 'text' }, alpha: prog(t, Bt(137), Bt(138)) });
        });
        // the two of them, small, walking on down the street until they are gone
        if (t < tTe) {
          const d = 3.6 + 9 * prog(t, T0, tTe), [vx, vy] = W(VP[0], VP[1]);
          const x = vx + (820 - vx) / d, y = vy + (1290 - vy) / d, h = 1080 / d;
          ctx.withPal(['memory', 'night', k], () => fig(ctx, env, `yt_walk_back_${step(t, T0)}`, fit(env, 'yt_walk_back_0', x, y, h), t, { seed: 62, shadow: false, alpha: 1 - prog(t, tSugi, tTe) }));
        }
        snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 200, seed: 1, alpha: 0.9 * prog(t, tSugi - 1, tTe + 1) });
      },
    },
    {
      id: 'b1-train', at: Bt(138), palette: 'memory',
      moment: 'Every goodbye: from inside the train, the back of his head in the dark car; through the window she waves on the platform; the train pulls away and she slides out of sight.',
      layout: 'his head and shoulder dark in the foreground left; the window; the platform with her waving beyond; the outside slides left',
      camera: (t) => { const d = drift(t, 63, 3), sh = t > DEPART ? Math.sin(t * 37) * 1.5 * clamp((t - DEPART) * 0.8) : 0; return { x: d.x, y: d.y + sh, zoom: 1.02, rot: d.rot }; },
      render(ctx, t, f, u) {
        const outside = (tt) => {                                            // the platform and her, as seen through the glass at time tt
          const ox = outsideX(tt);
          for (const dx of [0, 2040, 4080]) ctx.at(ox + dx, 0, () => backdrop(ctx, env, 'bg_platform_night', { focus: [0.36, 0.56], zoom: 1.5, blur: 3 }));
          if (tt < Bt(145.5)) ctx.at(ox, 0, () => fig(ctx, env, `y_wave_${waveFrame(tt)}`, fit(env, 'y_wave_0', 1240, 1010, 720), tt, { at: u.at, seed: 64 }));
        };
        const moving = t > DEPART + 0.3;
        if (moving) ctx.trail(5, 0.016 + 0.01 * clamp(t - DEPART - 0.3), (tau) => outside(t - tau), 0.6); else outside(t);
        // the glass: a faint reflection streak; the car is dark around the window
        dotFill(ctx, { x: 300, y: 120, w: 520, h: 760 }, 'ice', { density: 0.05, cell: 9, alpha: 0.5 });
        ctx.rect(-60, -40, 2040, 150, { fill: true, color: 'panel' });       // window head
        ctx.rect(-60, 935, 2040, 200, { fill: true, color: 'panel' });       // sill
        ctx.line(-60, 110, 1980, 110, { color: 'text', alpha: 0.35, width: 2 });
        ctx.line(-60, 935, 1980, 935, { color: 'text', alpha: 0.35, width: 2 });
        // him: the back of his head and shoulder, dark, in the car (never his face)
        const sway = t > DEPART ? 3 * Math.sin(t * 9) * clamp(t - DEPART) : 0;
        fig(ctx, env, 'yt_back_bust', fit(env, 'yt_back_bust', 330 + sway, 1260, 1150), t, { at: u.at, seed: 65, roles: { text: 'sub' } }   /* the coat a little dimmer in the dark car; the hood keeps its official pale blue */);
      },
    },
    {
      id: 'b1-eye', at: Bt(146), palette: 'voice',
      moment: 'Back in the booth, saying it: every time she waved she nearly cried. Her eye, close: a tear wells and runs.',
      layout: 'her eye filling the frame; slow push in',
      camera: (t) => { const d = drift(t, 66, 3), k = easeInOut(prog(t, Bt(146), Bt(151))); return { x: d.x - 20 * k, y: d.y + 10 * k, zoom: 1.0 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.62, 0.45], fogK: 0.4 });
        const fr = t < tSoU ? 0 : t < tNi6 ? 1 : 2, w = 1560;
        fig(ctx, env, `y_eye_tear_${fr}`, { x: 700 - w / 2, y: 540 - (w * 1398) / 1096 / 2, w, h: (w * 1398) / 1096 }, t, { at: u.at, seed: 67 });
      },
    },
    {
      id: 'b1-fist', at: Bt(151), palette: 'voice',
      moment: 'She presses her clenched hand to her chest, eyes closed, holding it in.',
      layout: 'her bust, the fist at her chest; push in',
      camera: (t) => { const d = drift(t, 68, 4), k = easeInOut(prog(t, Bt(151), B(38))); return { x: d.x, y: d.y + 30 * k, zoom: 1.02 + 0.1 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.3, 0.45], fogK: 0.55 });
        fig(ctx, env, 'y_fist_booth', fit(env, 'y_fist_booth', 880, 1110, 1060), t, { at: u.at, seed: 69 });
      },
    },
  ];
}

export function b1Sfx() { return []; }        // memory and a held breath: the music alone
