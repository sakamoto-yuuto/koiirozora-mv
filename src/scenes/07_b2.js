// B2 (212.21 - 234.61): she calls again. "I felt that the two of us could be strong"; "I want to feel you closer, more".
// docs/STORYBOARD_v2.md §1 B2 + v2.1 (the machine answers by sound only; one unit per bar).
//
// Beat map (node tools/beatmap.mjs 212 235.2):
//  212.21  BAR 66    CUT: the LED close: connected - 19 -> 18; the beep (sound only)                               night
//  213.01  beat 266  CUT (ふ 212.97): a print: her bust far left, his back far right; their colour plates (her wine,     memory
//                    his amber) slide towards each other; on 強 216.61 the plates meet, on く 216.94 the figures follow;
//                    on 気 219.14 - た 220.14 they land in register: his back to us, facing her
//  222.61  beat 278  CUT (も 222.91): the receiver pressed to her ear with both hands; a step in on each もっと (222.91, 224.36)  cold
//  228.21  BAR 71    CUT (く 228.17): the LED drops a unit on the bar
//  229.81  beat 287  CUT (感 229.41): her face, close; she opens her eyes on い 231.82
import { cues } from './cues.js';
import { charTimes } from './kit.js';
import { fig, fit } from './stage.js';
import { panelAt, ledDigits, units, boothInside } from './props.js';
import { dotLight, dotFill, drift, misreg } from '../components/print.js';
import { clamp, easeInOut, easeOut, easeBack, prog, pulse } from '../engine/util.js';

const ALL_ROLES = ['bg', 'panel', 'line', 'ice', 'text', 'sub', 'mute', 'you', 'youHot', 'me', 'meHot', 'phone'];

export function b2Shots(env) {
  const { B, Bt } = cues(env);
  const at = (line, ch, nth = 0) => { let n = 0; for (const c of charTimes(env, line)) if (c.c === ch && n++ === nth) return c.t; return null; };
  const tTsuyo = at(15, '強'), tKu = at(15, 'く'), tKi = at(15, '気'), tTa = at(15, 'た', 1) ?? at(15, 'た');
  const tMo1 = at(16, 'も'), tMo2 = at(16, 'も', 1), tI = at(16, 'い');

  const ledShot = (id, cut, until, moment) => ({
    id, at: cut, palette: 'night', moment, layout: 'the phone close: the LED window and the keys',
    camera: (t) => { const d = drift(t, 160, 3); return { x: d.x, y: d.y, zoom: 1.0 + 0.05 * prog(t, cut, until) + 0.015 * pulse(t - cut - 0.15, 8), rot: d.rot }; },
    render(ctx, t, f, u) {
      ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
      dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.28, cell: 13 });
      const Pn = panelAt(0.56, 0.3, 860, 520, 3000);
      fig(ctx, env, 'obj_phone_panel', Pn.d, t, { at: u.at, seed: 161 });
      ledDigits(ctx, Pn, units(env, t));
    },
  });

  return [
    ledShot('b2-connect', B(66), Bt(266), 'The call goes through - his machine again. One more unit gone; the beep, and she speaks again.'),
    {
      id: 'b2-print', at: Bt(266), palette: 'memory',
      moment: '"If it were the two of us, I felt we could be strong": two figures printed apart - her, and his back - their colour plates sliding together, then the figures, until the print is in register: him facing her.',
      layout: 'a paper ground; her bust left, his back bust right; colour plates first, figures after; slow push',
      camera: (t) => { const d = drift(t, 162, 3), k = easeInOut(prog(t, Bt(266), Bt(278))); return { x: d.x, y: d.y, zoom: 1.0 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'raised' });
        dotFill(ctx, { x: -60, y: -40, w: 2040, h: 1160 }, 'panel', { density: 0.06, cell: 14, alpha: 0.6 });
        dotLight(ctx, 900, 480, 900, 'youHot', { alpha: 0.18, cell: 14 });
        // where they end: her (deeper, smaller) left of centre, his back (nearer, bigger) right, overlapping her shoulder
        const herEnd = fit(env, 'y_bust_eyesopen', 760, 1130, 960), hisEnd = fit(env, 'yt_back_bust', 1180, 1160, 1000);   // both cut by the frame bottom
        const plateK = easeInOut(prog(t, Bt(266), tTsuyo)), figK = easeOut(prog(t, tKu, tKi + 0.25));
        const lock = pulse(t - tKi, 6) + pulse(t - tTa, 6) * 0.6;
        const slide = (d, dx, k) => ({ ...d, x: d.x + dx * (1 - k) });
        // the two colour plates (flat silhouettes), out of register, meeting on 強
        const hp = slide(herEnd, -700, plateK), mp = slide(hisEnd, 700, plateK);
        env.art.inks(ctx, 'y_bust_eyesopen', { ...hp, x: hp.x - 18, y: hp.y + 14 }, { plates: [{ ink: 'all', role: 'me', alpha: 0.85 }] });
        fig(ctx, env, 'yt_back_bust', { ...mp, x: mp.x + 18, y: mp.y + 14 }, t, { shadow: false, roles: Object.fromEntries(ALL_ROLES.map((r) => [r, 'you'])), alpha: 0.85, breathe: 0 });
        // the figures: they follow the plates and land in register on 気がした
        if (t >= tKu - 0.3) {
          const kick = misreg(t, 163, { base: 3, kick: 14, cut: tKi });
          const a = clamp((t - tKu + 0.3) * 3);
          const hf = slide(herEnd, -360, figK), mf = slide(hisEnd, 360, figK);
          fig(ctx, env, 'y_bust_eyesopen', { ...hf, x: hf.x + kick[0] * (1 - figK), y: hf.y - 6 * lock }, t, { seed: 164, alpha: a });
          fig(ctx, env, 'yt_back_bust', { ...mf, x: mf.x - kick[0] * (1 - figK) }, t, { seed: 165, alpha: a });
        }
      },
    },
    {
      id: 'b2-closer', at: Bt(278), palette: 'cold',
      moment: '"More, more - I want to feel you closer": she presses the receiver to her ear with both hands; one step closer on each もっと.',
      layout: 'her profile in the booth; the camera steps in twice, then keeps pushing',
      camera: (t) => {
        const d = drift(t, 166, 3), s1 = easeBack(clamp((t - tMo1) / 0.3)), s2 = easeBack(clamp((t - tMo2) / 0.3));
        return { x: d.x + 40 * s1 + 50 * s2, y: d.y - 20 * s1 - 20 * s2, zoom: 1.0 + 0.1 * s1 + 0.12 * s2 + 0.05 * prog(t, tMo2, B(71)), rot: d.rot };
      },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.3, 0.45], fogK: 0.55 });
        fig(ctx, env, 'y_receiver_close_0', fit(env, 'y_receiver_close_0', 820, 1150, 1180), t, { at: u.at, seed: 167 });
      },
    },
    ledShot('b2-led', B(71), Bt(287), 'And the units run down, one more on the bar.'),
    {
      id: 'b2-face', at: Bt(287), palette: 'cold',
      moment: 'Her face, close, the receiver against it: wanting to feel him - she opens her eyes.',
      layout: 'her face and the receiver filling the frame; slow push',
      camera: (t) => { const d = drift(t, 168, 3), k = easeInOut(prog(t, Bt(287), B(73))); return { x: d.x, y: d.y, zoom: 1.0 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.3, 0.4], fogK: 0.6 });
        const crop = { x: 120, y: 0, w: 640, h: 560 }, w = 1500, h = (w * crop.h) / crop.w;
        fig(ctx, env, `y_receiver_close_${t >= tI ? 1 : 0}`, { x: 960 - w / 2 - 120, y: 540 - h / 2 + 60, w, h }, t, { at: u.at, seed: 169, crop });
      },
    },
  ];
}

export function b2Sfx(env) {
  const { B } = cues(env);
  return [
    { t: B(66) + 0.4, kind: 'beep', rel: -10, dur: 0.4 },               // ピー: his machine records again
    { t: B(71), kind: 'key', rel: -20, pan: 0.3 },                       // the LED drops
  ];
}
