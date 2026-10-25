// BRIDGE (273.01 - 294.21): the instrumental build. She leaves the booth; he is already gone ahead. Cut together faster and
// faster, until their two tracks cross in the snow at the crossroads. docs/STORYBOARD_v2.md v2.2 (episode 4: すれ違い).
//
// Beat map (bars 3.2 s; no lyrics):
//  273.01  BAR 85     CUT: the booth front: she has stepped out, her back to us; across the snow in front of the booth runs a
//                     line of fresh footprints - his. The camera tilts down to them                                  night
//  273.81  beat 342   CUT: the snow close: his big prints; her boots step in beside them and walk off the other way
//  276.21  BAR 86     CUT: him from behind, before the electronics shop window; on every screen she is singing         tv
//  279.41  BAR 87     CUT: her, small, walking away down a far street; a lamp flares on each beat                       night
//  282.61  BAR 88     CUT: him walking left past other people's lit windows
//  285.81  BAR 89     cuts every 2 beats: her walking right / him walking left past the windows - mirror images
//  289.01  BAR 90     cuts every beat: their feet - her boots, his shoes
//  292.21  BAR 91     CUT: the crossroads from above: her track and his track cross under the lamp; the camera rises
//  294.21             (next: the final chorus)
import { cues } from './cues.js';
import { fig, fit, backdrop, plateAt } from './stage.js';
import { TV_SCREENS } from './06_v2.js';
import { walkingFeet, footprint, topTrack, midTrack, WALKS } from './feet.js';
import { snow } from '../components/world.js';
import { dotLight, drift, nearSnow, beatEnv } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

const WARM = { youHot: '#f4c27e', you: '#e3a35a' };
const FAR = { focus: [0.5, 0.56], zoom: 1.7 };                       // the night street without the booth

/** A footprint (a shoe in the snow) at (x, y), pointing along angle a (radians, 0 = right), size s px long. */
function print(ctx, x, y, a, s, alpha = 0.85) {
  ctx.at(x, y, () => {
    ctx.rrect(-s / 2, -s * 0.21, s * 0.6, s * 0.42, s * 0.2, { fill: 'line', alpha });          // the sole, pressed in
    ctx.rrect(s * 0.16, -s * 0.17, s * 0.32, s * 0.34, s * 0.15, { fill: 'line', alpha });      // the heel
    ctx.rrect(-s / 2 + s * 0.06, -s * 0.21, s * 0.44, s * 0.12, s * 0.06, { fill: 'panel', alpha: alpha * 0.6 });   // the shadowed wall of the dent
  }, { rot: a + Math.PI });
}
/** A line of prints from p0 to p1 (screen px), step = distance between steps, s = print length, k = 0..1 drawn so far. */
function track(ctx, p0, p1, step, s, k = 1, alpha = 0.85) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy), a = Math.atan2(dy, dx), n = Math.floor((L / step) * k);
  const nx = -dy / L, ny = dx / L;
  for (let i = 0; i <= n; i++) {
    const side = i % 2 ? 1 : -1, x = p0[0] + (dx * i * step) / L + nx * side * s * 0.35, y = p0[1] + (dy * i * step) / L + ny * side * s * 0.35;
    print(ctx, x, y, a, s, alpha);
  }
}

/** The snowy ground seen from ankle height: pale snow, a darker band far off, a few lumps. */
function snowGround(ctx, t, seed) {
  ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'ice' });
  ctx.rect(-60, -40, 2040, 620, { fill: true, color: 'line', alpha: 0.55 });                    // the street far off, dark
  ctx.rect(-60, 560, 2040, 30, { fill: true, color: 'sub', alpha: 0.5 });
  for (let i = 0; i < 60; i++) ctx.circle(-60 + rand(seed, i) * 2040, 600 + rand(seed + 1, i) * 520, 4 + 10 * rand(seed + 2, i), { fill: true, color: 'text', alpha: 0.45 });
}

// ---- her walk away (shared with 10_c3.js: she keeps walking through the cut) ------------------------------------------
/** Her distance down the street (1 = near) and her walk drawing, from FILM time; T_HIM = when he starts down his street. */
export function walkers(env) {
  const { B, P } = cues(env), T_HER = B(86);
  const haveHerAway = () => env.art?.dim?.y_walk_away_0;
  return {
    T_HER, T_HIM: B(88) + 2 * P, haveHerAway,
    herD: (t) => 1.25 + 0.2 * Math.max(0, t - T_HER),                  // she walks slower than he does (and started earlier)
    herAway: (t) => (haveHerAway() ? `y_walk_away_${Math.floor((t - T_HER) / (P / 4)) % 4}` : 'y_walk_back'),
  };
}
/**
 * Her walk-away drawings have short legs (38 % of her height below the coat; she is ~47 % everywhere else, user review):
 * drawn in two parts, the legs below the coat hem stretched x1.4. Only used small, far down a street. h = height top to sole.
 */
const HEM = { W: 279, H: 760, top: 12, hem: 464, sole: 747, legs: 1.4 };
export function drawHerAway(ctx, env, t, name, x, ySole, h, seed, roles = null) {
  const s = h / (HEM.hem - HEM.top + (HEM.sole - HEM.hem) * HEM.legs), w = HEM.W * s;
  const lowH = (HEM.H - HEM.hem) * HEM.legs * s, yHem = ySole - (HEM.sole - HEM.hem) * HEM.legs * s;
  fig(ctx, env, name, { x: x - w / 2, y: yHem, w, h: lowH }, t, { crop: { x: 0, y: HEM.hem, w: HEM.W, h: HEM.H - HEM.hem }, seed, breathe: 0, shadow: false, roles });
  fig(ctx, env, name, { x: x - w / 2, y: yHem - HEM.hem * s, w, h: HEM.hem * s + 1 }, t, { crop: { x: 0, y: 0, w: HEM.W, h: HEM.hem + 1 }, seed, breathe: 0, shadow: false, roles });
}

export function bridgeShots(env) {
  const { B, Bt, P } = cues(env);
  const herSide = (t, t0) => `y_walk_${Math.floor((t - t0) / (P / 4)) % 4}`;
  const hisSide = (t, t0) => `yt_walk_side_${Math.floor((t - t0) / (P / 4)) % 4}`;

  /** A row of lit windows seen flat-on from the street (another family's house); he walks left across it. */
  const windowsWalk = (ctx, t, t0, plate, { y = 1060, h = 560, x0 = 1900 } = {}) => {
    backdrop(ctx, env, plate, { focus: [0.5, 0.5], zoom: 1.1, roles: WARM });
    const x = x0 - 0.72 * h * 1.08 * Math.max(0, t - t0);              // the speed of his drawn stride, never stops
    fig(ctx, env, hisSide(t, t0), fit(env, 'yt_walk_side_0', x, y, h * 1.08), t, { seed: 202, breathe: 0, shadow: false });
    snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 170, seed: 204 });
  };

  // ---- continuity: each of them walks on all the time; a shot only looks at them. Distance along the street (1 = near)
  // and the walk drawing are functions of FILM time, so every cut back finds them further along, mid-stride.
  const { herD, herAway, haveHerAway, T_HIM } = walkers(env);
  const herLongLegs = (ctx, t, name, x, ySole, h, seed) => drawHerAway(ctx, env, t, name, x, ySole, h, seed);
  const hisD = (t) => 1.5 + 0.3 * Math.max(0, t - T_HIM);
  const hisAway = (t) => `yt_walk_away_${Math.floor((t - T_HIM) / (P / 4)) % 4}`;
  /** Far down a snowy street, walking away: her on the street as it is, him on the same street mirrored (another street). */
  const farStreet = (ctx, t, who, i) => {
    const draw = () => {
      backdrop(ctx, env, 'bg_street_night', FAR);
      const [vx, vy] = plateAt(env, 'bg_street_night', 0.478, 0.616, FAR), d = who === 'her' ? herD(t) : hisD(t);
      const name = who === 'her' ? herAway(t) : hisAway(t), base = who === 'her' ? (haveHerAway() ? 'y_walk_away_0' : 'y_walk_back') : 'yt_walk_away_0';
      const gx = vx + (1000 - vx) / d, gy = vy + (1250 - vy) / d;
      if (who === 'her' && haveHerAway()) herLongLegs(ctx, t, name, gx, gy, (1060 * 160) / 175 / d, 240 + i);
      else fig(ctx, env, name, fit(env, base, gx, gy, 1060 / d), t, { seed: 240 + i, breathe: 0, shadow: false });
      const be = beatEnv(env, t, 5);                                     // a lamp flares on each beat
      for (const [u0, v0] of [[0.30, 0.10], [0.62, 0.12]]) { const [x, y] = plateAt(env, 'bg_street_night', u0, v0, FAR); dotLight(ctx, x, y, 260, 'bloom', { alpha: 0.3 * be, cell: 10 }); }
      snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 230, seed: 241 + (who === 'her' ? 0 : 1) });
    };
    if (who === 'her') draw(); else ctx.at(1920, 0, draw, { sx: -1 });
  };

  // the build: BAR 89 a cut every 2 beats, BAR 90 every beat - her, him, her, him ...; each cut a little closer
  const ALT = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i < 4 ? B(89) + 2 * i * P : B(90) + (i - 4) * P, i % 2 ? 'him' : 'her']);

  return [
    {
      id: 'br-out', at: B(85), palette: 'night',
      moment: 'She has stepped out of the booth into the snow; the call is over.',
      layout: 'the lit booth behind her; her back to us in the foreground, outside; slow push',
      camera: (t) => { const d = drift(t, 200, 3), k = easeInOut(prog(t, B(85) + 0.8, B(86) - 0.4)); return { x: d.x - 40 * k, y: d.y + 30 * k, zoom: 1.0 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.55], zoom: 1.05 };
        backdrop(ctx, env, 'bg_booth_front', opt);
        fig(ctx, env, 'y_stop_back', fit(env, 'y_stop_back', 1040, 1330, 1150), t, { at: u.at, seed: 204 });   // outside, in the foreground, the booth behind her
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 200, seed: 205 });
      },
    },
    {
      id: 'br-tv', at: B(86), palette: 'tv',
      moment: 'Him, before the electronics shop window: on every screen she is singing. He stands a moment, then walks on.',
      layout: 'his back bust left of centre; the window full of TVs showing her beyond',
      camera: (t) => { const d = drift(t, 212, 3), k = easeInOut(prog(t, B(86), B(87))); return { x: d.x + 40 * k, y: d.y, zoom: 1.0 + 0.07 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.53, 0.47], zoom: 1.7 };
        backdrop(ctx, env, 'bg_tv_shop', opt);
        TV_SCREENS.forEach((s, k) => {
          const [x0, y0] = plateAt(env, 'bg_tv_shop', s[0], s[1], opt), [x1, y1] = plateAt(env, 'bg_tv_shop', s[2], s[3], opt), r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
          if (r.x > 1960 || r.x + r.w < -40) return;
          ctx.clip(r, () => {
            ctx.rect(r.x, r.y, r.w, r.h, { fill: true, color: 'panel' });
            fig(ctx, env, `y_stage_${Math.floor((t + k * 0.37) / 0.6) % 2}`, fit(env, 'y_stage_0', r.x + r.w / 2, r.y + r.h * 1.15, r.h * 1.25), t, { seed: 220 + k, breathe: 0 });
            ctx.rect(r.x, r.y, r.w, r.h, { fill: true, color: 'ice', alpha: 0.05 + 0.04 * Math.sin(t * 31 + k) });
          });
          dotLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 1.1, 'bloom', { alpha: 0.16, cell: 9 });
        });
        fig(ctx, env, 'yt_back_bust', fit(env, 'yt_back_bust', 640, 1180, 900), t, { at: u.at, seed: 213, roles: { text: 'sub' } });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 140, seed: 214, size: 4 });
      },
    },
    {
      id: 'br-her-far', at: B(87), palette: 'night',
      moment: 'Her, small, walking away down the snowy street; a lamp flares on each beat.',
      layout: 'the far street, wide; her walking away from us',
      camera: (t) => { const d = drift(t, 215, 3), k = easeInOut(prog(t, B(87), B(88))); return { x: d.x, y: d.y, zoom: 1.0 + 0.04 * k, rot: d.rot }; },
      render(ctx, t, f, u) { farStreet(ctx, t, 'her', 0); nearSnow(ctx, t, { count: 4, seed: 218, alpha: 0.12 }); },
    },
    {
      id: 'br-him-windows', at: B(88), palette: 'night',
      moment: 'Him walking left past the lit windows of other homes, on his way home.',
      layout: 'a house front flat-on, its warm windows; him walking left across it',
      camera: (t) => { const d = drift(t, 219, 3); return { x: d.x, y: d.y, zoom: 1.02, rot: d.rot }; },
      render(ctx, t, f, u) { windowsWalk(ctx, t, B(88), 'bg_window_family'); },
    },
    ...ALT.map(([cut, who], i) => ({
      id: `br-alt-${i}-${who}`, at: cut, palette: 'night',
      moment: who === 'her' ? 'Her, further down her street each time.' : 'Him, further down his street each time - mirror images, never meeting.',
      layout: 'a far snowy street (his: the same street mirrored); the figure small, walking away; each cut a little closer',
      camera: (t) => { const d = drift(t, 221 + i, 3); return { x: d.x, y: d.y, zoom: 1.04 + 0.05 * i + 0.03 * prog(t, cut, cut + P), rot: d.rot }; },
      render(ctx, t, f, u) { farStreet(ctx, t, who, i + 1); },
    })),
    {
      id: 'br-cross', at: B(91), palette: 'night',
      moment: 'The crossroads from above: her track and his cross in the snow under the lamp - they passed here, apart. The camera rises.',
      layout: 'top-down crossroads; her prints along one street, his along the other, crossing in the lamp light; crane up',
      camera: (t) => { const d = drift(t, 230, 2), k = easeInOut(prog(t, B(91), B(91) + 2.0)); return { x: d.x, y: d.y, zoom: 1.2 - 0.2 * k, rot: d.rot * 0.5 + 0.02 * k }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.5], zoom: 1.0 };
        backdrop(ctx, env, 'bg_crossroad_top', opt);
        const P2 = (u0, v0) => plateAt(env, 'bg_crossroad_top', u0, v0, opt);
        const kHer = easeOut(prog(t, B(91), B(91) + 1.0)), kHim = easeOut(prog(t, B(91) + 0.4, B(91) + 1.4));
        topTrack(ctx, env, 'her', P2(0.5, 1.05), P2(0.49, -0.05), 64, 46, kHer);   // her: up the street
        topTrack(ctx, env, 'his', P2(-0.05, 0.47), P2(1.05, 0.46), 76, 56, kHim);   // him: across it
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 220, seed: 231, speed: 50 });
      },
    },
  ];
}

export function bridgeSfx(env) {
  const { B, P } = cues(env), ev = [];
  ev.push({ t: B(85) + 0.1, kind: 'door', rel: -12, pan: 0.2 });              // the booth door
  for (let ts = B(85) + 0.9; ts < B(86); ts += P / 2) ev.push({ t: ts, kind: 'step', rel: -16, pan: 0.3 });
  return ev;
}
