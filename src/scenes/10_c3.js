// C3 (295.41 - 320.07): the final chorus, outdoors. The loneliness piles up like snow - on her, on the empty booth; the
// sleepless night; outside his window the smell of winter. He reaches home; she breathes out and looks up (-> 恋色の空).
// docs/STORYBOARD_v2.md v2.2. Lyrics: the shared right column (寂 is a hero word only in C1, L7).
//
// Beat map (node tools/beatmap.mjs 292 321.5):
//  295.41  BAR 92    CUT (ま 295.44): from the night sky down into the street: she is still walking, far away (her walk goes on
//                    from the bridge - same distance function)                                                         night
//  298.61  BAR 93    CUT (が 298.61): she has stopped; her back, head and shoulders; the snow lands on her hair and shoulders
//                    and stays (舞 300.92 - the flakes thicken)                                                           cold
//  301.81  BAR 94    CUT (雪 301.83): him, coming home down his lane towards the iron stairs of his flat                 night
//  305.01  BAR 95    CUT (て 305.84): the empty booth; the snow on its roof grows on every beat (積もってく, as in C1)
//  308.21  BAR 96    CUT (れ 308.18, 夜 309.78): his window, dark, close; the snow falls past it
//  311.41  BAR 97    CUT (の 311.43): him at the foot of the stairs, his back to us, looking up at it; push in
//  314.61  BAR 98    CUT (匂 315.38): her profile, eyes closed: she breathes out; the breath rises and the camera follows it up
//  320.07            (next: 見上げたなら - the sky)
import { cues } from './cues.js';
import { fig, fit, backdrop, plateAt } from './stage.js';
import { walkers, drawHerAway } from './09_bridge.js';
import { snow } from '../components/world.js';
import { dotLight, drift, nearSnow, beatEnv } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

const FAR = { focus: [0.5, 0.56], zoom: 1.7 };                          // the night street (as the bridge), without the booth
const GLASS = { u0: 625 / 1672, u1: 1035 / 1672, v0: 135 / 941, v1: 855 / 941 };
const ROOF = { u0: 557 / 1672, u1: 1100 / 1672, v: 20 / 941 };
const APT = { stairs: [0.455, 0.845], dark: [0.4964, 0.2784] };

export function c3Shots(env) {
  const { B, P } = cues(env);
  const { herD, herAway, haveHerAway } = walkers(env);

  // the top edge of her back view (head, shoulders): where falling snow can land and stay; found once from the ink map
  let edge = null;
  const topEdge = () => {
    if (edge) return edge;
    edge = [];
    for (let i = 0; i <= 60; i++) {
      const u = 0.2 + 0.6 * (i / 60);
      for (let v = 0; v < 0.6; v += 0.004) if (env.art.inkAt('y_stop_back', u, v)) { edge.push([u, v]); break; }
    }
    return edge;
  };

  return [
    {
      id: 'c3-down', at: B(92), palette: 'night',
      moment: 'The loneliness she kept in her heart: from the night sky the camera comes down into the snowy street; she is still walking, far away.',
      layout: 'crane down from the dark sky and the wires to the far street; her small in the middle, walking away',
      camera: (t) => { const d = drift(t, 250, 3), k = easeInOut(prog(t, B(92), B(92) + 2.4)); return { x: d.x, y: d.y - 420 * (1 - k), zoom: 1.08 - 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-80, -560, 2080, 700, { fill: true, color: 'bg' });         // more sky above the plate, for the crane
        backdrop(ctx, env, 'bg_street_night', FAR);
        const [vx, vy] = plateAt(env, 'bg_street_night', 0.478, 0.616, FAR), d = herD(t), gx = vx + (1000 - vx) / d, gy = vy + (1250 - vy) / d;
        if (haveHerAway()) drawHerAway(ctx, env, t, herAway(t), gx, gy, (1060 * 160) / 175 / d, 251);
        snow(ctx, t, { r: { x: -80, y: -560, w: 2080, h: 1700 }, count: 330, seed: 252 });
        nearSnow(ctx, t, { count: 6, seed: 253, alpha: 0.14 });
      },
    },
    {
      id: 'c3-settle', at: B(93), palette: 'cold',
      moment: 'Piling up like falling snow: she has stopped; the snow lands on her hair and shoulders and stays there.',
      layout: 'her back, head and shoulders, big, right of centre; the street out of focus; flakes landing on her and staying',
      camera: (t) => { const d = drift(t, 254, 3), k = easeInOut(prog(t, B(93), B(94))); return { x: d.x, y: d.y + 20 * k, zoom: 1.0 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_street_night', { focus: [0.45, 0.4], zoom: 2.2, blur: 10 });
        const sz = env.art.size('y_stop_back'), crop = { x: 0, y: 0, w: sz.w, h: sz.h * 0.55 }, h = 1250, w = (h * crop.w) / crop.h, x = 680 - w / 2, y = 1120 - h;
        fig(ctx, env, 'y_stop_back', { x, y, w, h }, t, { at: u.at, seed: 255, crop });
        // the flakes that land on her: one every 0.07 s (faster from 舞), each falls the last 140 px and stays
        const E = topEdge(), g = ctx.g;
        g.fillStyle = ctx.col('text', 1); g.beginPath();
        for (let i = 0; i < 160; i++) {
          const tl = B(93) + 0.15 + i * (i < 30 ? 0.09 : 0.045), dt = t - tl;
          if (dt < -0.6) break;
          const [eu, ev] = E[Math.floor(rand(256, i) * E.length)], px = x + (eu * sz.w / crop.w) * w + (rand(257, i) - 0.5) * 10, py = y + (ev * sz.h / crop.h) * h + 4;
          const fy = dt < 0 ? py + dt * 240 : py, r = 3 + 3.5 * rand(258, i);
          g.moveTo(px + r, fy); g.arc(px, fy, r, 0, 6.2832);
        }
        g.fill();
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 160 + 120 * prog(t, B(93) + 2, B(93) + 3), seed: 259, size: 4 });
      },
    },
    {
      id: 'c3-home', at: B(94), palette: 'night',
      moment: 'Him, coming home down his lane towards the iron stairs of his flat.',
      layout: 'the apartment block from the lane; him walking away from us towards the foot of the stairs',
      camera: (t) => { const d = drift(t, 260, 3), k = easeInOut(prog(t, B(94), B(95))); return { x: d.x, y: d.y, zoom: 1.0 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.5], zoom: 1.0 };
        backdrop(ctx, env, 'bg_his_apt_ext', opt);
        const [sx, sy, s] = plateAt(env, 'bg_his_apt_ext', APT.stairs[0] + 0.03, APT.stairs[1] + 0.02, opt);
        const k = prog(t, B(94), B(95) + 0.4), d = lerp(1, 3.2, k);           // from near the camera to the stairs
        const q = (d - 1) / 2.2, x = lerp(1250, sx, q), y = lerp(1250, sy, q), h = (300 * s * 3.2) / d;   // perspective: size ~ 1 / distance
        fig(ctx, env, `yt_walk_away_${Math.floor((t - B(94)) / (P / 4)) % 4}`, fit(env, 'yt_walk_away_0', x, y, h), t, { seed: 261, shadow: false, breathe: 0 });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 240, seed: 262 });
      },
    },
    {
      id: 'c3-booth', at: B(95), palette: 'cold',
      moment: 'The empty booth, still lit; the snow on its roof grows on every beat.',
      layout: 'the booth front, wide and empty; the roof snow rising; heavy snow',
      camera: (t) => { const d = drift(t, 263, 3), k = easeInOut(prog(t, B(95), B(96))); return { x: d.x, y: d.y - 20 * k, zoom: 1.0 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.5], zoom: 1.04 };
        backdrop(ctx, env, 'bg_booth_front', opt);
        const [rx0, ry] = plateAt(env, 'bg_booth_front', ROOF.u0, ROOF.v, opt), [rx1] = plateAt(env, 'bg_booth_front', ROOF.u1, ROOF.v, opt);
        const steps = 1 + Math.floor((t - B(95)) / P), grow = 18 + 12 * steps + 10 * easeOut(clamp(((t - B(95)) % P) / 0.3));
        const pts = [];
        for (let i = 0; i <= 24; i++) { const k = i / 24, x = lerp(rx0 - 6, rx1 + 6, k); pts.push([x, ry + 6 - grow * Math.sin(Math.PI * k) ** 0.5 * (0.85 + 0.15 * Math.sin(k * 17 + 2))]); }
        pts.push([rx1 + 6, ry + 10], [rx0 - 6, ry + 10]);
        ctx.poly(pts, { fill: true, color: 'text', close: true });
        ctx.poly(pts.slice(0, 25), { color: 'ice', width: 2, alpha: 0.7 });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 330, seed: 264, size: 3.8, speed: 75 });
        nearSnow(ctx, t, { count: 8, seed: 265, alpha: 0.16 });
      },
    },
    {
      id: 'c3-window', at: B(96), palette: 'night',
      moment: 'A sleepless night: his window, dark, the snow falling past it.',
      layout: 'the dark window of his flat close, between the lit ones; slow push',
      camera: (t) => { const d = drift(t, 266, 3), k = easeInOut(prog(t, B(96), B(97))); return { x: d.x, y: d.y, zoom: 1.0 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_his_apt_ext', { focus: [APT.dark[0], APT.dark[1] + 0.03], zoom: 3.2 });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 200, seed: 267, size: 5, speed: 55 });
      },
    },
    {
      id: 'c3-stairs', at: B(97), palette: 'night',
      moment: 'Outside his window, the smell of winter: he stands at the foot of the stairs, his back to us, and looks up at it.',
      layout: 'close on the iron stairs: him at their foot, his back to us; the dark window above; tilt up towards it',
      camera: (t) => { const d = drift(t, 268, 3), k = easeInOut(prog(t, B(97), B(98))); return { x: d.x, y: d.y, zoom: 1.0 + 0.04 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const k = easeInOut(prog(t, B(97) + 1.0, B(98) - 0.2));                 // tilt up from him to his dark window
        const opt = { focus: [lerp(0.47, APT.dark[0], k), lerp(0.62, APT.dark[1] + 0.05, k)], zoom: 1.9 };
        backdrop(ctx, env, 'bg_his_apt_ext', opt);
        const [sx, sy, s] = plateAt(env, 'bg_his_apt_ext', APT.stairs[0] + 0.03, APT.stairs[1] + 0.02, opt);
        fig(ctx, env, 'yt_back_crowd', fit(env, 'yt_back_crowd', sx, sy, 300 * s), t, { at: u.at, seed: 269, shadow: false });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 240, seed: 270 });
      },
    },
    {
      id: 'c3-breath', at: B(98), palette: 'cold',
      moment: 'She breathes out, eyes closed - the smell of winter - and the breath rises; the camera follows it up towards the sky.',
      layout: 'her profile, big, lower right of centre, facing left; the breath rising; tilt up into the falling snow',
      camera: (t) => { const d = drift(t, 271, 3), k = easeInOut(prog(t, B(98) + 1.2, B(100) - 0.8)); return { x: d.x, y: d.y - 520 * k, zoom: 1.0 - 0.04 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-80, -700, 2080, 1840, { fill: true, color: 'bg' });
        backdrop(ctx, env, 'bg_street_night', { focus: [0.4, 0.3], zoom: 1.6, blur: 9, dst: { x: -60, y: -40, w: 2040, h: 1160 } });
        ctx.rect(-80, -700, 2080, 660, { fill: true, color: 'bg' });
        const sz = env.art.size('y_breath'), h = 1150, w = (h * sz.w) / sz.h, x = 980 - w / 2, y = 1120 - h;
        fig(ctx, env, 'y_breath', { x, y, w, h }, t, { at: u.at, seed: 272 });
        // her breath: a soft cloud of dots leaving her lips on each bar, rising and spreading
        const mx = x + 0.29 * w, my = y + 0.37 * h;
        for (const tb of [B(98) + 0.6, B(99), B(99) + 1.6]) {
          const k = prog(t, tb, tb + 2.6);
          if (k <= 0 || k >= 1) continue;
          dotLight(ctx, mx - 60 * k, my - 380 * k, 70 + 210 * k, 'text', { alpha: 0.5 * (1 - k), cell: 9 });
        }
        snow(ctx, t, { r: { x: -80, y: -700, w: 2080, h: 1840 }, count: 300, seed: 273 });
      },
    },
  ];
}

export function c3Sfx(env) {
  const { B } = cues(env);
  return [
    { t: B(98) + 0.6, kind: 'breath', rel: -18 },
    { t: B(99) + 1.6, kind: 'breath', rel: -20 },
  ];
}
