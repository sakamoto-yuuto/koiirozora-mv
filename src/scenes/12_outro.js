// Outro + end (333.81 - 395.41): he comes home. docs/STORYBOARD_v2.md v2.2: the dark window lights; he stands in his
// room in his coat (snow still on it), the 用件 lamp blinking; his hand stops one beat over 再生, then presses it - and her
// first line comes back in the right column: the whole song was this message. Then the crossroads at dawn: their two
// tracks crossing, half filled with new snow, nobody there. Credits; dead.
//
// Beat map (node tools/beatmap.mjs 333 396; the band plays on to BAR 117, then fades out to silence by ~392):
//  333.81  BAR 104  CUT his flat from the lane; the sky still koi, turning back to night; push in on his door: he is at it
//  338.61           (BAR 105 + 2 beats) he goes in: the door is shut
//  340.21  BAR 106  his dark window lights
//  343.41  BAR 107  CUT his room, the light on: his back, standing in his coat by the low table; the lamp blinks on the beat
//  349.81  BAR 109  CUT the table close: their two cold mugs; the machine's lamp blinking
//  356.21  BAR 111  CUT his back, head and shoulders, looking down
//  362.61  BAR 113  CUT the machine close, 用件 2 blinking; a slow push to the keys; his shadow comes over it (368.2)
//  372.61           his hand comes in; it stops over 再生 for two beats (374.61)
//  376.21  beat 470 he presses 再生: the reels turn; her first line comes back in the column (黄 377.6 ... を 381.2)
//  377.81  beat 472 CUT his lit window from outside, snow; the line goes on
//  381.81  BAR 119  CUT the crossroads at dawn from above: two tracks crossing, half filled; credits 383.4;
//                   the line breaks into snow (387.4); fade to dead 390.4 - 392.4; 395.41 end
import { cues } from './cues.js';
import { fig, fit, backdrop, plateAt } from './stage.js';
import { tableUV, MUG_CM } from './02_v1.js';
import { topTrack } from './feet.js';
import { printChar, COLUMN } from './kit.js';
import { segDigits } from '../components/phone.js';
import { snow } from '../components/world.js';
import { dotLight, drift, nearSnow } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog } from '../engine/util.js';

// ---- where things are in the pictures (u, v in 0..1, measured on the codex sources) -------------------------------
const APT = {                                                       // bg_his_apt_ext, the upper floor
  door: { u0: 0.3689, u1: 0.4167, v0: 0.229, v1: 0.436 },           // his door (left of his window): top, floor
  dark: { u0: 0.4616, u1: 0.5333, v0: 0.2289, v1: 0.3379 },         // his window
  lit: { u0: 0.6299, u1: 0.6942, v0: 0.2608, v1: 0.3602 },          // the neighbour's lit window (copied into his when it lights)
  rail: (u) => 0.3315 + (u - 0.369) * 0.132,                        // the top of the corridor railing
};
const ENTER = { door: { u0: 0.36, u1: 0.66, v0: 0.04, v1: 0.83 } };  // his_enter_back: the open doorway he stands in
const ROOM = { lamp: [0.559, 0.644], ceiling: [0.53, 0.06] };       // bg_his_room_night: the machine's lamp, the ceiling light
const MACHINE = {                                                   // obj_machine (1162 x 944)
  lamp1: [0.175, 0.338], lamp2: [0.167, 0.441], r: 0.017,
  keys: [0.175, 0.339, 0.5, 0.662, 0.822], keyTop: 0.655, keyW: 0.142, labelV: 0.612,
  led: [0.268, 0.155, 0.1],                                         // the 用件 counter in the dark window: left, top, height
};
const KEY_NAMES = ['巻戻', '再生', '停止', '早送', '録音'];
const HAND = { key: [0.4597, 0.5646], keyW: 0.103 };               // his_hand_press: the bottom of the fingertip; the width of the key it was drawn on
const KEY2 = { u0: 0.268, u1: 0.412, v0: 0.652, v1: 0.8 };           // obj_machine: the 再生 key
const LINE0 = 0;

export function outroShots(env) {
  const { B, P } = cues(env);
  const T = { home: B(104), inside: B(105) + 2 * P, light: B(106), room: B(107), table: B(109), bust: B(111), machine: B(113),
    shadow: B(114) + 3 * P, hand: B(116) + 0.4, hover: B(116) + 3 * P, press: B(117) + P, window: B(117) + 3 * P, dawn: B(119), dead0: 390.41, dead: 392.41 };
  const blink = (t) => (((t - B(104)) % P) < P / 2 ? 1 : 0);        // the 用件 lamp: on for half of every beat
  // her first line, played back from his tape: as she said it after the beep (74.61), from just after the press
  const replay = env.lyrics.lines[LINE0].chars.map((c) => ({ c: c.c, t: T.press + 0.35 + (c.t - 74.61) }));
  const breakAt = T.dawn + 5.6;
  const LIT = ['night', 'memory', 0.4];                            // his room with the light on: the night plate, warmed

  /** The line in the right column (all of it now - 黄昏 too: there is no lightbox here), then it breaks into snow. */
  const column = (ctx, t) => {
    const size = COLUMN.size, cx = COLUMN.x;
    replay.forEach((c, j) => {
      const y = COLUMN.y + j * size * COLUMN.lineH;
      if (t < breakAt) {
        const e = easeOut(clamp((t - c.t) / 0.18));
        if (e > 0) printChar(ctx, c.c, cx, y + size * 0.88 - (1 - e) * 6, { size, alpha: e });
        return;
      }
      const k = clamp((t - breakAt - j * 0.04) / 2.6);
      if (k < 1) for (let q = 0; q < 9; q++) {
        const ox = (rand(601, j, q) - 0.5) * size, oy = (rand(603, j, q) - 0.5) * size;
        ctx.circle(cx + ox + Math.sin(k * 5 + q) * 14, y + size * 0.5 + oy + k * k * 380 + k * 40, (2.2 + 2.2 * rand(607, j, q)) * (1 - k * 0.5), { fill: true, color: 'text', alpha: (1 - k) * 0.9 });
      }
    });
    if (t >= replay[0].t - 0.1 && t < breakAt) ctx.rect(cx - 3, COLUMN.y - 34, 6, 22 * easeOut(clamp((t - replay[0].t) / 0.3)), { fill: true, color: 'me' });   // her mark
  };
  /** The light he switched on: a warm pool (radius r px) under the ceiling light at (x, y); the room plate is the night plate. */
  const roomLight = (ctx, x, y, r, a = 1) => ctx.withPal('memory', () => {
    dotLight(ctx, x, y + 0.35 * r, r, 'you', { alpha: 0.26 * a, cell: 13, sy: 0.7 });
    dotLight(ctx, x, y, 0.13 * r, 'youHot', { alpha: 0.7 * a, cell: 9 });
  });
  /** The machine's small red lamp in the room plate, blinking. */
  const roomLamp = (ctx, t, opt, s = 1) => {
    if (!blink(t)) return;
    const [x, y, ps] = plateAt(env, 'bg_his_room_night', ROOM.lamp[0], ROOM.lamp[1], opt);
    ctx.circle(x, y, 7 * ps * s, { fill: true, color: 'err' });
    dotLight(ctx, x, y, 140 * ps * s, 'err', { alpha: 0.55, cell: 8 });
  };
  /** His window from outside: his dark pane, lit by printing the neighbour's lit window into it. */
  const litWindow = (ctx, opt, k) => {
    if (k <= 0) return;
    const S = env.plates.size('bg_his_apt_ext'), L = APT.lit, D = APT.dark;
    const [x0, y0] = plateAt(env, 'bg_his_apt_ext', D.u0, D.v0, opt), [x1, y1] = plateAt(env, 'bg_his_apt_ext', D.u1, D.v1, opt);
    env.plates.draw(ctx, 'bg_his_apt_ext', { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, { crop: { x: L.u0 * S.w, y: L.v0 * S.h, w: (L.u1 - L.u0) * S.w, h: (L.v1 - L.v0) * S.h }, alpha: k });
    ctx.withPal('memory', () => dotLight(ctx, (x0 + x1) / 2, y1 + (y1 - y0) * 0.6, (x1 - x0) * 1.5, 'youHot', { alpha: 0.35 * k, cell: 10, sy: 0.6 }));
  };
  /** Flakes shaken off his coat as he stands there: they fall from his shoulders to the floor. */
  const coatSnow = (ctx, t, t0, dst, n = 7) => {
    for (let i = 0; i < n; i++) {
      const k = prog(t, t0 + 0.6 + i * 0.75, t0 + 1.9 + i * 0.75);
      if (k <= 0 || k >= 1) continue;
      const x = dst.x + dst.w * (0.36 + 0.28 * rand(611, i)) + Math.sin(k * 6 + i) * 8, y = dst.y + dst.h * (0.2 + 0.02 * rand(613, i)) + k * k * dst.h * 0.72;
      ctx.circle(x, y, 4 + 2 * rand(617, i), { fill: true, color: 'text', alpha: 0.9 * (1 - k * 0.6) });
    }
  };

  return [
    {
      id: 'outro-home', at: T.home, palette: (t) => ['koi', 'night', easeInOut(prog(t, T.home, T.home + 4.8))],
      moment: 'He reaches his flat: at his door on the upper floor, his back to us; he goes in, the door shuts, and his dark window lights up.',
      layout: 'his flat from the lane, slow push in on his door and his window; him small at the door above the railing; the window lights',
      camera: (t) => { const d = drift(t, 281, 3), k = easeInOut(prog(t, T.home, T.room)); return { x: d.x - 40 * k, y: d.y + 10 * k, zoom: 1.0 + 0.14 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.44, 0.33], zoom: 2.0 };
        backdrop(ctx, env, 'bg_his_apt_ext', opt);
        // him at his door, above the railing (the picture is cut at the top of the railing); gone when he has gone in
        const gone = clamp((t - T.inside) / 0.12);
        if (gone < 1) {
          const [dx0, dy0, s] = plateAt(env, 'bg_his_apt_ext', (APT.door.u0 + APT.door.u1) / 2, APT.door.v0, opt);
          const [, dy1] = plateAt(env, 'bg_his_apt_ext', APT.door.u0, APT.door.v1, opt);
          const sz = env.plates.size('his_enter_back'), E = ENTER.door, h = (dy1 - dy0) / (E.v1 - E.v0), w = (h * sz.w) / sz.h;
          const x = dx0 - ((E.u0 + E.u1) / 2) * w, y = dy0 - E.v0 * h;
          const [, ry] = plateAt(env, 'bg_his_apt_ext', (APT.door.u0 + APT.door.u1) / 2, APT.rail((APT.door.u0 + APT.door.u1) / 2), opt);
          const cut = (ry - y) / h;
          fig(ctx, env, 'his_enter_back', { x, y, w, h: h * cut }, t, { at: u.at, seed: 283, crop: { x: 0, y: 0, w: sz.w, h: sz.h * cut }, alpha: 1 - gone, shadow: false });
        }
        litWindow(ctx, opt, easeOut(clamp((t - T.light) / 0.14)));
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 240, seed: 285 });
        nearSnow(ctx, t, { count: 5, seed: 286, alpha: 0.12 });
      },
    },
    {
      id: 'outro-room', at: T.room, palette: LIT,
      moment: 'Inside, the light on. He stands in his coat by the low table, snow still on his shoulders; on the table the machine\'s lamp blinks.',
      layout: 'his room wide: his back, big, left of centre; the table and the blinking lamp right of him; slow push',
      camera: (t) => { const d = drift(t, 287, 3), k = easeInOut(prog(t, T.room, T.table)); return { x: d.x + 50 * k, y: d.y + 20 * k, zoom: 1.0 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.45], zoom: 1.15 };
        backdrop(ctx, env, 'bg_his_room_night', opt);
        const [lx, ly] = plateAt(env, 'bg_his_room_night', ROOM.ceiling[0], ROOM.ceiling[1], opt);
        roomLight(ctx, lx, ly, 900);
        roomLamp(ctx, t, opt);
        const dst = fit(env, 'yt_back_crowd', 470, 1170, 1000);
        fig(ctx, env, 'yt_back_crowd', dst, t, { at: u.at, seed: 288 });
        coatSnow(ctx, t, T.room, dst);
      },
    },
    {
      id: 'outro-table', at: T.table, palette: LIT,
      moment: 'Their two mugs, cold, still on his table; next to them the machine\'s lamp blinks.',
      layout: 'the low table close: the two mugs left, the phone and the machine with its blinking lamp right; slow push to the lamp',
      camera: (t) => { const d = drift(t, 289, 3), k = easeInOut(prog(t, T.table, T.bust)); return { x: d.x + 60 * k, y: d.y + 10 * k, zoom: 1.0 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.64], zoom: 2.1 };
        backdrop(ctx, env, 'bg_his_room_night', opt);
        const [lx, ly] = plateAt(env, 'bg_his_room_night', ROOM.ceiling[0], ROOM.ceiling[1], opt);
        roomLight(ctx, lx, ly + 300, 1100, 0.9);
        for (const [name, a] of [['o2_mug_cream', 0.12], ['o2_mug_amber', 0.24]]) {
          const [uu, vv] = tableUV(a, 0.55), [x, y, ps] = plateAt(env, 'bg_his_room_night', uu, vv, opt), sz = env.plates.size(name);
          const crop = { x: 0, y: 0.36 * sz.h, w: sz.w, h: 0.64 * sz.h }, w = MUG_CM * 9.2 * ps, h = (w * crop.h) / crop.w;
          fig(ctx, env, name, { x: x - w / 2, y: y - h * 0.88, w, h }, t, { crop, shadow: false });
        }
        roomLamp(ctx, t, opt, 1.2);
      },
    },
    {
      id: 'outro-bust', at: T.bust, palette: LIT,
      moment: 'He looks down at it, his back to us; the red blink catches the edge of his coat.',
      layout: 'his head and shoulders from behind, big, centre; the room out of focus; the red light from below in front of him',
      camera: (t) => { const d = drift(t, 291, 3), k = easeInOut(prog(t, T.bust, T.machine)); return { x: d.x, y: d.y + 16 * k, zoom: 1.0 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_his_room_night', { focus: [0.52, 0.5], zoom: 1.9, blur: 10 });
        roomLight(ctx, 960, -120, 1000, 0.8);
        if (blink(t)) ctx.withPal('night', () => dotLight(ctx, 1000, 1180, 700, 'err', { alpha: 0.32, cell: 11, sy: 0.5 }));
        const dst = fit(env, 'yt_back_bust', 960, 1150, 1080);
        fig(ctx, env, 'yt_back_bust', dst, t, { at: u.at, seed: 292 });
        coatSnow(ctx, t, T.bust - 2.5, dst, 4);
      },
    },
    {
      id: 'outro-machine', at: T.machine, palette: LIT,
      moment: 'The answering machine: 用件 2 blinking. His shadow comes over it; his hand comes in and stops over 再生 for a beat - then presses it, and the reels turn.',
      layout: 'the machine close, slow push towards the keys; the 用件 counter top left; his hand from the right onto 再生',
      camera: (t) => { const d = drift(t, 293, 3), k = easeInOut(prog(t, T.machine, T.window)); return { x: d.x - 150 * k, y: d.y + 120 * k, zoom: 1.0 + 0.3 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        roomLight(ctx, 960, -260, 1200, 0.9);
        dotLight(ctx, 1600, 100, 800, 'ice', { alpha: 0.18, cell: 13 });                            // the snow light from his window
        const playing = t >= T.press, name = `obj_machine_${playing ? Math.floor((t - T.press) * 10) % 3 : 0}`;
        const w = 1450, h = (w * 944) / 1162, x = 960 - w / 2, y = 560 - h / 2, M = (uu, vv) => [x + uu * w, y + vv * h];
        fig(ctx, env, name, { x, y, w, h }, t, { at: u.at, seed: 294 });
        // 再生 goes down under his finger and stays down (a piano-key deck latches PLAY while the tape runs)
        const down = clamp((t - T.press + 0.06) / 0.12), kd = 9 * down;
        if (kd > 0) {
          const [ax, ay] = M(KEY2.u0, KEY2.v0), [bx, by] = M(KEY2.u1, KEY2.v1), S = env.plates.size(name), r0 = { x: ax, y: ay, w: bx - ax, h: by - ay };
          ctx.rect(ax, ay, bx - ax, by - ay, { fill: true, color: 'bg' });                       // the key well
          ctx.clip(r0, () => env.plates.draw(ctx, name, { ...r0, y: ay + kd }, { crop: { x: KEY2.u0 * S.w, y: KEY2.v0 * S.h, w: (KEY2.u1 - KEY2.u0) * S.w, h: (KEY2.v1 - KEY2.v0) * S.h } }));
        }
        // lamps (留守 on, as when it answered her; 録音 off) and the key names
        const r = MACHINE.r * w, [l1x, l1y] = M(...MACHINE.lamp1), [l2x, l2y] = M(...MACHINE.lamp2);
        ctx.circle(l1x, l1y, r, { fill: true, color: 'err' }); dotLight(ctx, l1x, l1y, r * 6, 'err', { alpha: 0.4, cell: 9 });
        ctx.text('留守', l1x + 2.2 * r, l1y + r * 0.6, { size: 1.6 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.8 });
        ctx.text('録音', l2x + 2.2 * r, l2y + r * 0.6, { size: 1.6 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.8 });
        KEY_NAMES.forEach((kn, i) => { const [kx, ky] = M(MACHINE.keys[i], MACHINE.labelV); ctx.text(kn, kx, ky, { size: 1.5 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.85, align: 'center' }); });
        // 用件 2: a red counter in the dark of the cassette window, blinking on the beat until it plays
        const [ex, ey] = M(MACHINE.led[0], MACHINE.led[1]), eh = MACHINE.led[2] * h;
        ctx.text('用件', ex + eh * 0.28, y + 0.105 * h, { size: 1.5 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.85, align: 'center' });
        if (playing || blink(t)) segDigits(ctx, '2', ex, ey, eh, { n: 1, color: 'err' });
        else segDigits(ctx, '', ex, ey, eh, { n: 1, color: 'err' });
        // his shadow comes over the machine as he steps up to it
        const sh = easeInOut(prog(t, T.shadow, T.shadow + 2.4));
        if (sh > 0) ctx.gradRect(-60, -40, 2040, 1160, [[0, 'bg', 0], [0.5, 'bg', 0.25 * sh], [1, 'bg', 0.5 * sh]], 'h');
        // his hand: in from the right, stops over 再生, presses it on the beat
        const [kx, ky] = M(MACHINE.keys[1], MACHINE.keyTop + 0.055), kw = MACHINE.keyW * w;
        const sz = env.plates.size('his_hand_press'), hw = (kw / HAND.keyW) * 1.02, hh = (hw * sz.h) / sz.w;
        // in from the right (T.hand), held 26 px above the key (T.hover ... T.press), down on the beat, rests, then away
        const inK = easeOut(prog(t, T.hand, T.hover)), away = easeInOut(prog(t, T.press + 0.7, T.window + 0.4));
        const lift = 26 * (1 - down) - kd + 14 * clamp((t - T.press - 0.35) / 0.2);
        if (inK > 0) fig(ctx, env, 'his_hand_press', { x: kx - HAND.key[0] * hw + (1 - inK) * 1300 + away * 1400, y: ky - HAND.key[1] * hh - lift - 60 * (1 - inK), w: hw, h: hh }, t, { seed: 295, roles: { 8: 'text' } });   // the light skin ink printed as cream: no speckle
        if (t >= T.press && t < T.press + 0.4) ctx.glow('err', 30, () => ctx.circle(l1x, l1y, r * 1.1, { fill: true, color: 'err', alpha: 0.9 }), 0.8 * Math.exp(-(t - T.press) * 8));
      },
      screen: (ctx, t) => column(ctx, t),
    },
    {
      id: 'outro-window', at: T.window, palette: 'night',
      moment: 'From outside: his lit window in the snow. Her first words come back, line by line - the message plays.',
      layout: 'his lit window close between the dark wall and the eaves; snow; her line in the right column',
      camera: (t) => { const d = drift(t, 297, 3), k = easeInOut(prog(t, T.window, T.dawn)); return { x: d.x, y: d.y, zoom: 1.0 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.3], zoom: 3.0 };
        backdrop(ctx, env, 'bg_his_apt_ext', opt);
        litWindow(ctx, opt, 1);
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 200, seed: 298, size: 5, speed: 55 });
      },
      screen: (ctx, t) => column(ctx, t),
    },
    {
      id: 'end-dawn', at: T.dawn, palette: (t) => ['cold', 'dead', easeInOut(prog(t, T.dead0, T.dead))], state: 'cold > dead',
      moment: 'Morning, the crossroads from above: her track and his cross in the snow, already half filled by the night\'s snow; nobody there. Credits; then dark.',
      layout: 'top-down crossroads, the lamp off, a low warm light from the top right; the two tracks crossing; slow crane up; credits bottom left',
      camera: (t) => { const d = drift(t, 299, 2), k = easeInOut(prog(t, T.dawn, T.dead)); return { x: d.x, y: d.y, zoom: 1.12 - 0.12 * k, rot: d.rot * 0.5 + 0.02 }; },
      render(ctx, t, f, u) {
        const opt = { focus: [0.5, 0.5], zoom: 1.0 };
        backdrop(ctx, env, 'bg_crossroad_top', { ...opt, roles: { 5: 'ice' } });              // the street lamp is off
        ctx.withPal('memory', () => dotLight(ctx, 1900, -100, 1500, 'youHot', { alpha: 0.3, cell: 14, sy: 0.8 }));   // the low morning sun
        const P2 = (u0, v0) => plateAt(env, 'bg_crossroad_top', u0, v0, opt);
        topTrack(ctx, env, 'her', P2(0.5, 1.05), P2(0.49, -0.05), 64, 46, 1, 0.6);          // the same tracks as the night they passed
        topTrack(ctx, env, 'his', P2(-0.05, 0.47), P2(1.05, 0.46), 76, 56, 1, 0.6);
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 60, seed: 300, size: 3, speed: 30, alpha: 0.7 });
        const dark = easeInOut(prog(t, T.dead0, T.dead));
        if (dark > 0) ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'panel', alpha: dark });
      },
      screen: (ctx, t) => {
        column(ctx, t);
        const ca = clamp(prog(t, T.dawn + 1.6, T.dawn + 3.0)) * (1 - easeInOut(prog(t, T.dead0, T.dead)));
        if (ca > 0.003) {
          // printed like her words (keyline + shadow plate) so they read on the busy snow
          const line = (str, y, size, weight, color) => {
            ctx.text(str, 126 + 3, y + 3, { size, font: 'serif', weight, color: 'bg', alpha: ca * 0.8 });
            ctx.text(str, 126, y, { size, font: 'serif', weight, color: 'bg', alpha: ca * 0.9, stroke: size * 0.22 });
            ctx.text(str, 126, y, { size, font: 'serif', weight, color, alpha: ca });
          };
          ctx.rect(104, 846, 4, 150, { fill: true, color: 'me', alpha: ca * 0.75 });
          line('恋色空', 892, 34, 700, 'text');
          line('森川由綺（CV：平野綾）', 930, 20, 500, 'text');
          line("作詞 Bee'　作曲・編曲 藤間仁", 960, 17, 500, 'sub');
          line('非公式ファンメイド', 986, 16, 500, 'sub');
        }
      },
    },
  ];
}

/** Sound of the outro: the door, the room's quiet, the relay and the tape of 再生 - and her voice on it. */
export function outroSfx(env) {
  const { B, P } = cues(env);
  const press = B(117) + P;
  return [
    { t: B(105) + 2 * P, kind: 'door', rel: -20, pan: -0.2 },
    { t: B(107), kind: 'hum', dur: B(117) - B(107), rel: -32 },
    { t: press, kind: 'relay', rel: -22, pan: 0.1 },
    { t: press + 0.02, kind: 'key', rel: -22, pan: 0.1 },
    { t: press + 0.28, kind: 'tape', dur: 7.0, rel: -26, pan: 0.05 },
    // her first line from his tape (the vocal stem 75.3 - 80.5 s, through the machine's speaker), in step with the column
    { t: press + 0.35 + (75.3 - 74.61), kind: 'voice', src: 75.3, dur: 5.2, rel: -4, pan: 0.05 },
  ];
}
