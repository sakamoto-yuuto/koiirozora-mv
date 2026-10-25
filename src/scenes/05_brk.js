// BREAK (173.81 - 186.61): her recording time is over and the line is cut - told only by the objects (v2.1: no
// LCD sentences, no read-out panels). The machine's second appearance of three.
// Beat map (node tools/beatmap.mjs 173.5 188.5; the music almost stops here):
//  173.81  BAR 54    CUT: his dark room, the machine close: a short ピ; 174.2 the 録音 lamp goes out, the reels stop;
//                    from 174.6 the 留守 lamp blinks once a second: a message is waiting (it is still blinking when he comes home)
//  175.41  beat 219  CUT: her in the booth: the busy tone in her ear - startled (y_listen 0)
//  177.01  BAR 55    she lowers her eyes (y_listen 1)
//  180.21  BAR 56    CUT: she has let go: the receiver hangs on its coiled cord in front of the phone, swinging to rest;
//                    the LED still shows her 19 units
//  186.61  BAR 58    (next: V2, she steps out of the booth)
import { cues } from './cues.js';
import { fig, fit } from './stage.js';
import { panelAt, ledDigits, PANEL, boothInside } from './props.js';
import { dotLight, drift } from '../components/print.js';
import { clamp, easeInOut, easeOut, prog } from '../engine/util.js';

const MACHINE = { lamp1: [0.175, 0.338], lamp2: [0.167, 0.441], r: 0.017 };   // as in 01_intro.js

export function brkShots(env) {
  const { B, Bt } = cues(env);
  const STOP = B(54) + 0.4;                                                 // the tape stops, the 録音 lamp goes out
  const UNITS = 19;                                                         // what is left on her card at the cut-off

  return [
    {
      id: 'brk-machine', at: B(54), palette: 'night',
      moment: 'In his empty room: a short beep - her recording time is over. The REC lamp goes out, the reels stop, and the message lamp starts to blink.',
      layout: 'the answering machine close, lamps left, reels in the window; very slow push',
      camera: (t) => { const d = drift(t, 111, 3); return { x: d.x - 40, y: d.y, zoom: 1.06 + 0.03 * prog(t, B(54), Bt(219)), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 1500, 120, 900, 'ice', { alpha: 0.24, cell: 13 });          // the snow light from his window
        const turning = t < STOP, name = `obj_machine_${turning ? Math.floor((t - B(54) + 10) * 10) % 3 : Math.floor((STOP - B(54) + 10) * 10) % 3}`;
        const w = 1380, h = (w * 944) / 1162, x = 960 - w / 2, y = 560 - h / 2;
        fig(ctx, env, name, { x, y, w, h }, t, { at: u.at, seed: 112 });
        const r = MACHINE.r * w, l1 = [x + MACHINE.lamp1[0] * w, y + MACHINE.lamp1[1] * h], l2 = [x + MACHINE.lamp2[0] * w, y + MACHINE.lamp2[1] * h];
        const blink = t < STOP + 0.2 ? 1 : ((t - STOP - 0.2) % 1) < 0.5 ? 1 : 0;   // 留守: steady, then 1 Hz (a message is waiting)
        const rec = 1 - clamp((t - STOP) / 0.08);                                // 録音: out
        for (const [[lx, ly], on] of [[l1, blink], [l2, rec]]) {
          if (on <= 0) continue;
          ctx.circle(lx, ly, r, { fill: true, color: 'err', alpha: on });
          dotLight(ctx, lx, ly, r * 7, 'err', { alpha: 0.45 * on, cell: 9 });
        }
        ctx.text('留守', l1[0] + 2.2 * r, l1[1] + r * 0.6, { size: 1.6 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.8 });
        ctx.text('録音', l2[0] + 2.2 * r, l2[1] + r * 0.6, { size: 1.6 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.8 });
      },
    },
    {
      id: 'brk-busy', at: Bt(219), palette: 'cold',
      moment: 'In the booth the line has gone to the busy tone. She is startled; then she lowers her eyes.',
      layout: 'her bust in the booth, the street out of focus; slow push',
      camera: (t) => { const d = drift(t, 113, 4), k = easeInOut(prog(t, Bt(219), B(56))); return { x: d.x + 20 * k, y: d.y + 15 * k, zoom: 1.04 + 0.09 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.6, 0.48], fogK: 0.65 });
        fig(ctx, env, t < B(55) ? 'y_listen_0' : 'y_listen_1', fit(env, 'y_listen_0', 980, 1100, 1010), t, { at: u.at, seed: 114 });
      },
    },
    {
      id: 'brk-receiver', at: B(56), palette: 'snow',
      moment: 'She has let go of the receiver: it hangs on its coiled cord in front of the phone, swinging to rest. The units stay at 19.',
      layout: 'the phone front, close; the receiver hanging from the cord in front of the keys; slow push',
      camera: (t) => { const d = drift(t, 115, 3), k = easeInOut(prog(t, B(56), B(58))); return { x: d.x, y: d.y + 30 * k, zoom: 1.0 + 0.07 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, -40, 1200, 'ice', { alpha: 0.26, cell: 13 });
        const Pn = panelAt(0.42, 0.18, 1000, 70, 1350);                    // the LED at the top, the receiver hanging below the hook
        fig(ctx, env, 'obj_phone_panel', Pn.d, t, { at: u.at, seed: 116 });
        ctx.withPal('night', () => ledDigits(ctx, Pn, UNITS));                 // the only colour in the frame
        // the receiver: a pendulum from the foot of the empty hook, hanging in front of the phone, swinging to rest
        const [px, py] = Pn.at(0.25, 0.63), dt = t - B(56), ang = 0.3 * Math.exp(-0.42 * dt) * Math.cos(2.6 * dt + 0.4);
        // o_receiver: the picture's own coiled cord starts at its top (u 0.464); the receiver fills u 0.36 - 0.67, v 0 - 0.85
        const rh = 560, rw = (rh * env.art.size('o_receiver').w) / env.art.size('o_receiver').h;
        ctx.at(px, py, () => {
          fig(ctx, env, 'o_receiver', { x: -0.464 * rw, y: 0, w: rw, h: rh }, t, { roles: { cream: 'sub', orange: 'bg', black: 'bg' }, breathe: 0 });
        }, { rot: ang });
      },
    },
  ];
}

export function brkSfx(env) {
  const { B, Bt } = cues(env);
  return [
    { t: B(54), kind: 'beep', rel: -8, dur: 0.25 },                         // the short ピ: recording time over
    { t: B(54) + 0.4, kind: 'relay', rel: -14 },                            // the tape stops
    { t: Bt(219) + 0.1, kind: 'busy', dur: B(56) - Bt(219) + 2.0, rel: -18 },   // ツー ツー in her ear, fading under the receiver shot
  ];
}
