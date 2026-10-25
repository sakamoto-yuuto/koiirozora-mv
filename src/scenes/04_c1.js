// C1 (122.61 - 173.81): the loneliness she kept in her heart piles up like snow; the sleepless night; "I want to hear
// your voice a little"; then the interlude: memories flash past on the beat until her hand on the receiver.
// docs/STORYBOARD_v2.md §1 C1 + v2.1. Hero word: 寂 (L7) - a brush character printed on the night sky that breaks
// into snow (blank in the column). Times are the hand taps (data/lyrics_film.json, 2026-10-23).
//
// Beat map (node tools/beatmap.mjs 122.5 175):
//  122.61  BAR 38   CUT (心 122.99): the booth from outside, her behind the glass; frost grows in from the glass edges, a step per beat
//  125.81  BAR 39   CUT: the night sky over the street. 寂 126.05: the brush character is PRINTED (stamp, misregistered)
//  129.38  L8 舞    its ink comes loose, stroke by stroke, as flakes; 散 129.99 the release speeds up; 雪 130.73 the camera tilts down
//  132.21  BAR 41   CUT: the booth, wide, in the snow: on 積 133.43 and every beat after, the snow on its roof grows
//  136.21  beat 170 CUT (眠 136.61): her room, night; she sits hugging her knees under the window; headlights on BAR 43 (夜 138.63)
//  141.81  BAR 44   CUT (強 142.58): close on her, face pressed to her knees; headlights pass over her on BAR 45
//  148.21  BAR 46   CUT (あ 149.02): the receiver pressed to her ear, eyes closed; slow push
//  153.81  beat 192 CUT: the phone's LED - it drops a unit on BAR 48 (154.61); す 155.46 こ し
//  157.81  BAR 49   CUT: her again; on 聞 158.34 she opens her eyes (y_receiver_close 1); い 159.15, held
//  161.01  BAR 50   the interlude: memories, one per 2 beats until BAR 52, then one per beat           memory
//  170.61  BAR 53   CUT: her hands round the receiver, still; the tape runs on (next: the cut-off, 173.81)  cold
import { cues } from './cues.js';
import { charTimes, heroChars } from './kit.js';
import { fig, fit, backdrop, plateAt } from './stage.js';
import { panelAt, ledDigits, units, boothInside } from './props.js';
import { PL as STREET, W as SW } from './02_v1.js';
import { snow, fog } from '../components/world.js';
import { dotLight, dotFill, dotCone, drift, nearSnow, misreg, beatEnv } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

// bg_booth_front (1672 x 941): the front glass and the roof, u / v in 0..1 of the plate
const GLASS = { u0: 625 / 1672, u1: 1035 / 1672, v0: 135 / 941, v1: 855 / 941 };
const ROOF = { u0: 557 / 1672, u1: 1100 / 1672, v: 20 / 941 };

/** Her inside the booth at life size (a 160 cm girl in a 2 m booth): the bust from the head down to the waist, the
 * lower body lost in the fogged lower glass. r = the glass on screen. */
function herInBooth(ctx, env, t, r, at, seed, name = 'y_wait_1') {
  fig(ctx, env, name, fit(env, 'y_wait_1', r.x + 0.52 * r.w, r.y + 0.8 * r.h, 0.6 * r.h), t, { at, seed });
  fog(ctx, { x: r.x, y: r.y + 0.62 * r.h, w: r.w, h: 0.38 * r.h }, { k: 0.95, cell: 7, seed: seed + 1 });
  ctx.rect(r.x, r.y, r.w, r.h, { fill: true, color: 'ice', alpha: 0.1 });              // the glass
}

/** Frost on a pane: a dot screen growing in from the four edges of rect r, one step per beat, with needles on the front. */
function frost(ctx, t, r, at, pulse_, { step = 26, max = 0.5 * Math.min(r.w, r.h), seed = 7 } = {}) {
  const beats = Math.max(0, (t - at) / 0.8);
  const front = Math.min(max, 10 + step * beats + 8 * easeOut(clamp((beats % 1) / 0.38)) + 6 * pulse_);
  const edge = (px, py) => Math.min(px - r.x, r.x + r.w - px, py - r.y, r.y + r.h - py);
  dotFill(ctx, r, 'ice', { density: 0.62, cell: 7, alpha: 0.8, vary: (px, py) => { const d = edge(px, py); return d > front ? 0 : 0.25 + 0.75 * (1 - d / Math.max(1, front)); } });
  dotFill(ctx, r, 'text', { density: 0.6, cell: 12, alpha: 0.55, vary: (px, py) => (Math.abs(edge(px, py) - front) < 14 ? 1 : 0) });
  for (let i = 0; i < 90; i++) {                                       // needles anchored on the front
    const side = i % 4, u = rand(seed, i, 1), d = front * (0.6 + 0.38 * rand(seed, i, 2));
    const x = side === 0 ? r.x + d : side === 1 ? r.x + r.w - d : r.x + u * r.w, y = side === 2 ? r.y + d : side === 3 ? r.y + r.h - d : r.y + u * r.h;
    const l = (12 + 40 * rand(seed, i, 3)) * (0.55 + 0.45 * pulse_), a = rand(seed, i, 4) * Math.PI;
    ctx.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, { color: 'ice', width: 1.3, alpha: 0.5 });
  }
}

export function c1Shots(env) {
  const { B, Bt, P } = cues(env);
  const at = (line, ch, nth = 0) => { let n = 0; for (const c of charTimes(env, line)) if (c.c === ch && n++ === nth) return c.t; return null; };
  const tJaku = heroChars(env, 7)[0].t, tMai = at(8, '舞'), tChi = at(8, '散'), tYuki = at(8, '雪'), tTsumo = at(8, '積'), tKiku = at(10, '聞');

  // ---- 寂: the brush character as a field of ink grains (built once from the art's ink map) -------------------------
  const J = { x: 760, y: 500, s: 800 };                                    // centre and size on screen
  let grains = null;
  const buildGrains = () => {
    const out = [], cell = 7, n = Math.floor(J.s / cell);
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
      const u = (gx + 0.5) / n, v = (gy + 0.5) / n;
      if (!env.art.inkAt('kanji_jaku', u, v)) continue;
      const x = J.x - J.s / 2 + u * J.s, y = J.y - J.s / 2 + v * J.s, k = out.length;
      // released stroke by stroke: the order follows the brush (top to bottom, left to right) with a little noise
      const order = clamp(0.55 * v + 0.35 * u + 0.18 * rand(511, k));
      out.push({ x, y, order, sway: rand(513, k) * 6.28, v: 120 + 160 * rand(515, k), r: 2.6 + 1.6 * rand(517, k) });
    }
    return out;
  };
  const release = (g) => tMai + 2.6 * Math.pow(g.order, 1.25) * (1 - 0.35 * clamp((g.order * 2.6 + tMai - tChi) / 2));

  // ---- the interlude montage ---------------------------------------------------------------------------------------
  const CUTS = [B(50), Bt(202), B(51), Bt(206), B(52), Bt(210), Bt(211), Bt(212)];    // 2 beats apart, then 1
  const MEM = ['dusk', 'hands', 'mugs', 'platform', 'window', 'pair', 'smile', 'hands2'];

  return [
    {
      id: 'c1-frost', at: B(38), palette: 'cold',
      moment: 'The loneliness she has kept in her heart: from outside, she is behind the booth glass, eyes closed, and frost grows in from the edges of the glass.',
      layout: 'the booth glass centred and close; her inside; frost advancing from the four edges; snow in front',
      camera: (t) => { const d = drift(t, 81, 4), k = easeInOut(prog(t, B(38), B(39))); return { x: d.x, y: d.y - 20 * k, zoom: 1 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.497, 0.4], zoom: 2.3 };              // close on her head and shoulders behind the pane
        backdrop(ctx, env, 'bg_booth_front', opt);
        const [gx0, gy0] = plateAt(env, 'bg_booth_front', GLASS.u0, GLASS.v0, opt), [gx1, gy1] = plateAt(env, 'bg_booth_front', GLASS.u1, GLASS.v1, opt);
        const r = { x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0 };
        ctx.clip(r, () => {
          herInBooth(ctx, env, t, r, u.at, 82);
          frost(ctx, t, r, u.at, beatEnv(env, t, 5), { step: 62 });
        });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 150, seed: 83, alpha: 0.85 });
        nearSnow(ctx, t, { count: 4, seed: 84, alpha: 0.1 });
      },
    },
    {
      id: 'c1-jaku', at: B(39), palette: 'cold',
      moment: '寂 - loneliness - printed on the night sky in one brush character; then its ink comes loose stroke by stroke and falls as snow.',
      layout: 'the dark sky over the street with its wires; the character left of centre, the lyric column clear on the right; tilt down as it falls',
      camera: (t) => { const d = drift(t, 85, 4), k = easeInOut(prog(t, tYuki, B(41))); return { x: d.x, y: d.y + 120 * k, zoom: 1.02 + 0.04 * prog(t, B(39), B(41)), rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_street_night', { focus: [0.5, 0.18], zoom: 1.5 });
        ctx.rect(-60, -40, 2040, 1300, { fill: true, color: 'bg', alpha: 0.45 });
        grains ??= buildGrains();
        const k0 = clamp((t - tJaku) / 0.12), kick = misreg(t, 86, { base: 6, kick: 22, cut: tJaku });
        const solid = 1 - prog(t, tMai, tMai + 0.25);
        if (t >= tJaku && solid > 0) {                                         // printed: the shadow plate, then the white ink
          const s = J.s * (1.08 - 0.08 * easeOut(k0)), dst = { x: J.x - s / 2, y: J.y - s / 2, w: s, h: s };
          env.art.inks(ctx, 'kanji_jaku', dst, { plates: [{ ink: 'all', role: 'line', offset: [kick[0] + 10, kick[1] + 8], alpha: 0.9 }, { ink: 'all', role: 'text' }], alpha: solid * clamp(k0 * 3) });
          if (k0 < 1) dotLight(ctx, J.x, J.y, J.s * 0.7, 'ice', { alpha: 0.4 * (1 - k0), cell: 12 });
        }
        if (t >= tMai) {                                                       // the grains: in place, then falling as flakes
          const g = ctx.g;
          g.fillStyle = ctx.col('text', 1); g.beginPath();
          for (const q of grains) {
            const tr = release(q), dt = t - tr;
            let x = q.x, y = q.y, r = 3.3;
            if (dt > 0) { y += q.v * dt + 90 * dt * dt; x += Math.sin(q.sway + dt * 2.2) * 18 * Math.min(1, dt) + 30 * dt; r = q.r; }
            else if (solid > 0.02) continue;                                   // the solid print still covers it
            if (y > 1160) continue;
            g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832);
          }
          g.fill();
        }
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1300 }, count: 90, seed: 87, alpha: 0.6 });
      },
    },
    {
      id: 'c1-pile', at: B(41), palette: 'cold',
      moment: 'It piles up like snow: the booth in the snowy street, and the snow on its roof growing beat by beat.',
      layout: 'the booth front, wide; her small behind the glass; the roof snow rising; heavy snow falling',
      camera: (t) => { const d = drift(t, 88, 4), k = easeInOut(prog(t, B(41), Bt(170))); return { x: d.x, y: d.y - 30 * k, zoom: 1.0 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.5], zoom: 1.04 };
        backdrop(ctx, env, 'bg_booth_front', opt);
        const [gx0, gy0] = plateAt(env, 'bg_booth_front', GLASS.u0, GLASS.v0, opt), [gx1, gy1] = plateAt(env, 'bg_booth_front', GLASS.u1, GLASS.v1, opt);
        const r = { x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0 };
        ctx.clip(r, () => { herInBooth(ctx, env, t, r, u.at, 89); frost(ctx, t, r, B(38) - 4, 0, { step: 62, max: 0.5 * Math.min(r.w, r.h) * 0.8 }); });
        // the roof snow: a mound that grows a step on 積 and on every beat after it
        const [rx0, ry] = plateAt(env, 'bg_booth_front', ROOF.u0, ROOF.v, opt), [rx1] = plateAt(env, 'bg_booth_front', ROOF.u1, ROOF.v, opt);
        const steps = t < tTsumo ? 0 : 1 + Math.floor((t - tTsumo) / P), grow = 11 * steps + 10 * easeOut(clamp(((t - tTsumo) % P) / 0.3)) * (t >= tTsumo ? 1 : 0);
        if (grow > 0) {
          const pts = [];
          for (let i = 0; i <= 24; i++) { const k = i / 24, x = lerp(rx0 - 6, rx1 + 6, k); pts.push([x, ry + 6 - grow * Math.sin(Math.PI * k) ** 0.5 * (0.85 + 0.15 * Math.sin(k * 17 + 2))]); }
          pts.push([rx1 + 6, ry + 10], [rx0 - 6, ry + 10]);
          ctx.poly(pts, { fill: true, color: 'text', close: true });
          ctx.poly(pts.slice(0, 25), { color: 'ice', width: 2, alpha: 0.7 });
        }
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 320, seed: 90, size: 3.8, speed: 75 });
        nearSnow(ctx, t, { count: 8, seed: 91, alpha: 0.16 });
      },
    },
    {
      id: 'c1-room', at: Bt(170), palette: 'cold',
      moment: 'A sleepless night: in her room she sits hugging her knees under the window, wanting to be sure of this happiness; headlights sweep across the wall.',
      layout: 'her room dark, the window with the snowy town; her small under it; light sweeps right to left; slow push in',
      camera: (t) => { const d = drift(t, 92, 4), k = easeInOut(prog(t, Bt(170), B(44))); return { x: d.x - 40 * k, y: d.y + 20 * k, zoom: 1.0 + 0.14 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.45, 0.5], zoom: 1.05 };
        backdrop(ctx, env, 'bg_her_room_night', opt);
        const [wx0, wy0] = plateAt(env, 'bg_her_room_night', 0.105, 0.0, opt), [wx1, wy1] = plateAt(env, 'bg_her_room_night', 0.6, 0.43, opt);
        ctx.clip({ x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0 }, () => snow(ctx, t, { r: { x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0 }, count: 60, seed: 93, size: 2.4, speed: 30 }));
        // headlights: a pale slab of light crossing the ceiling and wall, right to left, on three bar lines
        for (const ts of [B(43), B(44), B(45)]) {
          const k = prog(t, ts, ts + 1.4);
          if (k <= 0 || k >= 1) continue;
          const x = lerp(2200, -400, easeInOut(k)), a = Math.sin(Math.PI * k);
          ctx.clipPath([[x - 260, -40], [x + 60, -40], [x + 380, 1120], [x + 40, 1120]], () => dotFill(ctx, { x: x - 300, y: -40, w: 720, h: 1160 }, 'text', { density: 0.5 * a, cell: 9, alpha: 0.85 }));
        }
        fig(ctx, env, 'y_sit', fit(env, 'y_sit', 760, 1000, 560), t, { at: u.at, seed: 94 });
      },
    },
    {
      id: 'c1-room-close', at: B(44), palette: 'cold',
      moment: 'She wants to be sure of this happiness: close on her, her face pressed to her knees; the last headlights pass over her.',
      layout: 'her head and knees close, the window light behind; slow push',
      camera: (t) => { const d = drift(t, 93, 3), k = easeInOut(prog(t, B(44), B(46))); return { x: d.x + 20 * k, y: d.y + 10 * k, zoom: 1.0 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_her_room_night', { focus: [0.33, 0.35], zoom: 2.4, blur: 5 });
        const k = prog(t, B(45), B(45) + 1.4);
        if (k > 0 && k < 1) { const x = lerp(2200, -400, easeInOut(k)), a = Math.sin(Math.PI * k); ctx.clipPath([[x - 260, -40], [x + 60, -40], [x + 380, 1120], [x + 40, 1120]], () => dotFill(ctx, { x: x - 300, y: -40, w: 720, h: 1160 }, 'text', { density: 0.5 * a, cell: 9, alpha: 0.85 })); }
        const sz = env.art.size('y_sit'), crop = { x: 0, y: 0, w: sz.w, h: 0.62 * sz.h }, h = 1180, w = (h * crop.w) / crop.h;
        fig(ctx, env, 'y_sit', { x: 860 - w / 2, y: 1120 - h, w, h }, t, { at: u.at, seed: 95, crop });
      },
    },
    {
      id: 'c1-receiver', at: B(46), palette: 'cold',
      moment: '"I want to hear your voice, just a little": she presses the receiver to her ear with both hands, eyes closed.',
      layout: 'her profile close, the receiver in both hands; slow push',
      camera: (t) => { const d = drift(t, 95, 3), k = easeInOut(prog(t, B(46), Bt(192))); return { x: d.x + 30 * k, y: d.y, zoom: 1.02 + 0.07 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.3, 0.45], fogK: 0.55 });
        fig(ctx, env, 'y_receiver_close_0', fit(env, 'y_receiver_close_0', 820, 1150, 1180), t, { at: u.at, seed: 96 });
      },
    },
    {
      id: 'c1-led', at: Bt(192), palette: 'cold',
      moment: 'The LED: her units running down, one more gone on the bar.',
      layout: 'the phone close: the LED window and the keys; the cord swaying',
      camera: (t) => { const d = drift(t, 97, 3); return { x: d.x, y: d.y, zoom: 1.0 + 0.1 * easeInOut(prog(t, Bt(192), B(49))) + 0.015 * pulse(t - B(48), 8), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.28, cell: 13 });
        const Pn = panelAt(0.56, 0.3, 860, 520, 3000);
        fig(ctx, env, 'obj_phone_panel', Pn.d, t, { at: u.at, seed: 98 });
        ledDigits(ctx, Pn, units(env, t));
      },
    },
    {
      id: 'c1-receiver2', at: B(49), palette: 'cold',
      moment: 'On "I want to hear" she opens her eyes, brows drawn, holding the receiver close.',
      layout: 'her profile closer than before; push in',
      camera: (t) => { const d = drift(t, 99, 3), k = easeInOut(prog(t, B(49), B(50))); return { x: d.x + 20 * k, y: d.y - 10 * k, zoom: 1.08 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.3, 0.45], fogK: 0.6 });
        fig(ctx, env, `y_receiver_close_${t >= tKiku ? 1 : 0}`, fit(env, 'y_receiver_close_0', 820, 1150, 1180), t, { at: u.at, seed: 100 });
      },
    },
    ...CUTS.map((cut, i) => ({
      id: `c1-mem-${i}-${MEM[i]}`, at: cut, palette: 'memory',
      moment: 'The interlude: memories flash past on the beat, faster and faster.',
      layout: { dusk: 'the dusk street, the two walking', hands: 'their joined hands', mugs: 'two mugs on his table', platform: 'her waving on the platform', window: 'the back of his head in the train', pair: 'the two of them, far', smile: 'her smile in the booth', hands2: 'their joined hands, closer' }[MEM[i]],
      enter: { type: 'cut', flash: 0.18, flashColor: 'text', flashDecay: 14 },
      camera: (t) => { const d = drift(t, 101 + i, 3), k = prog(t, cut, CUTS[i + 1] ?? B(53)); return { x: d.x + (i % 2 ? -30 : 30) * k, y: d.y, zoom: 1.03 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) { memory(ctx, env, t, MEM[i], u.at, i); },
    })),
    {
      id: 'c1-hands', at: B(53), palette: 'cold',
      moment: 'Back in the booth: her hands round the receiver, still. The tape is still running.',
      layout: 'her two hands on the receiver, close; slow push',
      camera: (t) => { const d = drift(t, 109, 3), k = easeInOut(prog(t, B(53), B(54))); return { x: d.x, y: d.y, zoom: 1.0 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.3, 0.45], fogK: 0.6 });
        const crop = { x: 120, y: 330, w: 520, h: 520 }, w = 1250;
        fig(ctx, env, 'y_receiver_close_0', { x: 960 - w / 2, y: 540 - w / 2, w, h: w }, t, { at: u.at, seed: 110, crop });
      },
    },
  ];
}

/** One memory of the interlude, printed full frame in the memory state. */
function memory(ctx, env, t, kind, at, i) {
  const step = (t0) => Math.floor((t - t0) / 0.2) % 4;
  if (kind === 'dusk' || kind === 'pair') {
    env.plates.draw(ctx, 'bg_street_dusk', STREET);
    const [vx, vy] = SW(0.478, 0.616), d = kind === 'dusk' ? 1.6 : 4.5;
    fig(ctx, env, `yt_walk_back_${step(at)}`, fit(env, 'yt_walk_back_0', vx + (820 - vx) / d, vy + (1290 - vy) / d, 1080 / d), t, { at, seed: 120 + i, shadow: false });
  } else if (kind === 'hands' || kind === 'hands2') {
    backdrop(ctx, env, 'bg_street_dusk', { focus: [0.47, 0.72], zoom: 2.3, blur: 12 });
    const crop = kind === 'hands' ? { x: 530, y: 1560, w: 1100, h: 620 } : { x: 760, y: 1700, w: 700, h: 394 }, w = 2160;
    fig(ctx, env, 'yt_hands_back', { x: 960 - w / 2, y: 540 - (w * crop.h) / crop.w / 2, w, h: (w * crop.h) / crop.w }, t, { at, seed: 121, crop });
  } else if (kind === 'mugs') {
    const opt = { focus: [0.5, 0.655], zoom: 2.6 };
    backdrop(ctx, env, 'bg_his_room_warm', opt);
    for (const [name, a] of [['o2_mug_cream', 0.45], ['o2_mug_amber', 0.59]]) {
      const ux = (545 + (1000 - 545) * a) / 1672, vy = 645 / 941, [x, y, s] = plateAt(env, 'bg_his_room_warm', ux, vy, opt);
      const sz = env.plates.size(name), w = 16 * 9.2 * s, h = (w * sz.h) / sz.w;
      fig(ctx, env, name, { x: x - w / 2, y: y - h * 0.92, w, h }, t, { at, seed: 122 });
    }
  } else if (kind === 'platform') {
    backdrop(ctx, env, 'bg_platform_night', { focus: [0.36, 0.56], zoom: 1.5, blur: 2 });
    fig(ctx, env, `y_wave_${[0, 1, 2, 1][Math.floor((t - at) / 0.14) % 4]}`, fit(env, 'y_wave_0', 1000, 1100, 900), t, { at, seed: 123 });
  } else if (kind === 'window') {
    backdrop(ctx, env, 'bg_platform_night', { focus: [0.5, 0.5], zoom: 1.3, blur: 6 });
    fig(ctx, env, 'yt_train_window', fit(env, 'yt_train_window', 900, 1100, 1060), t, { at, seed: 124 });
  } else if (kind === 'smile') {
    boothInside(ctx, env, t, { focus: [0.62, 0.48], fogK: 0.4 });
    fig(ctx, env, 'y_smile_1', fit(env, 'y_smile_0', 1000, 1110, 1060), t, { at, seed: 125 });
  }
}

export function c1Sfx(env) {
  const { B } = cues(env);
  return [
    { t: B(38), kind: 'hum', dur: B(39) - B(38) - 0.1, rel: -26 },                // the booth's tube light, outside
    { t: B(48), kind: 'key', rel: -19, pan: 0.3 },                                  // the LED drops a unit
    { t: B(53), kind: 'hum', dur: B(54) - B(53) - 0.1, rel: -26 },
  ];
}
