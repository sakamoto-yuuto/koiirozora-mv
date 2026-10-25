// C2 (234.61 - 273.01): her frozen heart and the warmth she wants; nowhere in the world anything warmer than him; the
// card runs out. v2.2: from here two lines are cut together - she in the booth, he on his way home (docs/STORYBOARD_v2.md).
//
// Beat map (node tools/beatmap.mjs 234.5 273.2):
//  234.61  BAR 73    CUT (心 234.99): from outside, her palm on the frosted glass; the frost thickens          cold
//  237.81  BAR 74    CUT (る 238.05): HIM - a night platform, the train pulls out right and leaves his back on the platform  night
//  241.01  BAR 75    CUT (そ 241.44): the palm again; the frost melts outwards from it; 温 243.81: amber light through the hole,
//                    the camera pushes into the light                                                                  cold > memory
//  247.41  BAR 77    CUT (世 248.55): along the telephone wire from window to window, a whip every 2 beats:
//                    a family (247.41) - a couple (249.01) - an old couple (250.61) - and at the end of the wire, him (252.21)
//  254.61  beat 318  CUT (あ 254.97): memory - his hands wrap the scarf round her neck                          memory
//  260.21  BAR 81    CUT (な 261.05): him, small, walking away under the street lamps                           night
//  263.41  BAR 82    CUT (き 264.27): the phone's LED: 2                                                         cold
//  266.61  BAR 83    CUT (他 267.48): the intro's street, same camera: she is in the lit booth, eyes closed, the receiver at her
//                    ear - and HE walks away from us down the street, right past the booth, without turning; his footprints
//                    stay in the snow (episode 4's near miss at the public phone: she is calling, he walks right past)  night
//  269.81  BAR 84    CUT: the LED shows 0, the card pops out of the slot                                          cold
//  271.01  beat 338.5 CUT (ら 271.21): she holds the empty card at her chest and looks at it
import { cues } from './cues.js';
import { charTimes } from './kit.js';
import { fig, fit, backdrop, plateAt, kind } from './stage.js';
import { panelAt, ledDigits, units, PANEL, boothInside } from './props.js';
import { footprint } from './feet.js';
import { PL as STREET, W as SW, VP } from './02_v1.js';
import { snow, fog } from '../components/world.js';
import { dotLight, dotFill, drift, nearSnow, beatEnv } from '../components/print.js';
import { clamp, easeIn, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

const WARM = { youHot: '#f4c27e', you: '#e3a35a' };
const FAR = { focus: [0.5, 0.56], zoom: 1.7 };                       // the street plate, cropped so the booth (u > 0.8) is out of frame                 // lit windows stay warm in the cold night
const HOLD = { card: { u0: 0.217, u1: 0.569, v0: 0.096, v1: 0.459 } }; // h_card_hold: the card in the picture

/** His street: the night street mirrored and cropped (no booth: it is not her street yet); him walking away, d = distance. */
function hisStreet(ctx, env, t, name, d, seed) {
  ctx.at(1920, 0, () => backdrop(ctx, env, 'bg_street_night', FAR), { sx: -1 });
  const [vx, vy] = plateAt(env, 'bg_street_night', VP[0], VP[1], FAR), x = 1920 - vx;
  fig(ctx, env, name, fit(env, name.startsWith('yt_walk_away') ? 'yt_walk_away_0' : name, x + (900 - x) / d, vy + (1250 - vy) / d, 1000 / d), t, { seed, shadow: false });
}

export function c2Shots(env) {
  const { B, Bt, P } = cues(env);
  const at = (line, ch, nth = 0) => { let n = 0; for (const c of charTimes(env, line)) if (c.c === ch && n++ === nth) return c.t; return null; };
  const tAtata = at(18, '温'), tRa = at(21, 'ら');
  const hisWalk = (t, t0) => (kind(env, 'yt_walk_away_0') ? `yt_walk_away_${Math.floor((t - t0) / (P / 4)) % 4}` : 'yt_back_crowd');

  /** The palm on the glass, from outside; melt = 0..1 (the frost gone round the hand, the amber light in). */
  const palm = (ctx, t, u, melt) => {
    ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
    dotLight(ctx, 980, 420, 900, 'ice', { alpha: 0.35, cell: 13 });                           // the booth's tube light behind the glass
    const w = 760, h = (w * 1448) / 1086, x = 980 - w / 2, y = 1100 - h, cx = 980, cy = 600;
    if (melt > 0) dotLight(ctx, cx, cy, 360 + 520 * melt, 'youHot', { alpha: 0.85 * melt, cell: 11 });   // the warmth coming through
    fig(ctx, env, 'h_glass', { x, y, w, h }, t, { at: u.at, seed: 171, roles: { cream: 'text', orange: melt > 0.05 ? 'youHot' : 'ice', black: 'bg' } });
    // the frost over the whole pane, with a hole round the hand that opens as it melts
    const hole = 30 + 520 * easeOut(melt), beats = (t - B(73)) / P;
    dotFill(ctx, { x: -60, y: -40, w: 2040, h: 1160 }, 'ice', { density: 0.5 + 0.03 * Math.min(8, beats), cell: 8, alpha: 0.75, vary: (px, py) => clamp((Math.hypot(px - cx, py - cy) - hole) / 140) });
    fog(ctx, { x: -60, y: -40, w: 2040, h: 1160 }, { k: 0.4 * (1 - melt), cell: 7, seed: 172 });
  };

  // the wire: windows side by side along one strip, the camera whips from one to the next every two beats
  const STRIP = [['bg_window_family', [0.5, 0.45]], ['bg_window_couple', [0.5, 0.45]], ['bg_window_old', [0.5, 0.45]], ['him', null]];
  const STOPS = [B(77), Bt(311), B(78), Bt(315)];
  const stripX = (t) => {
    let x = 0;
    STOPS.forEach((s, i) => { if (i) x += 2100 * easeInOut(clamp((t - s + 0.3) / 0.3)); });   // a 0.3 s whip that lands on the beat
    return x;
  };

  /** The near miss (c2-pass), drawn unmirrored; the shot mirrors it. */
  const passBody = (ctx, t, u) => {
        env.plates.draw(ctx, 'bg_street_night', STREET);
        // her, in the booth, behind the frosted glass
        const [gx0, gy0] = SW(0.855, 0.33), [gx1, gy1] = SW(0.955, 0.76), r = { x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0 };
        ctx.clip(r, () => {
          fig(ctx, env, 'y_wait_1', fit(env, 'y_wait_1', r.x + 0.55 * r.w, r.y + 0.8 * r.h, 0.62 * r.h), t, { roles: { cream: 'sub', orange: 'me', black: 'bg' }, breathe: 1 });
          fog(ctx, { x: r.x, y: r.y + 0.55 * r.h, w: r.w, h: 0.45 * r.h }, { k: 0.9, cell: 6, seed: 190 });
        });
        dotLight(ctx, (gx0 + gx1) / 2, (gy0 + gy1) / 2, 2.2 * r.w, 'bloom', { alpha: 0.25, cell: 9 });
        // him: from the camera down the street towards the vanishing point; past the booth at about 1.2 s
        const [vx, vy] = SW(VP[0], VP[1]), k = prog(t, B(83) - 0.2, B(84) + 0.2), d = 0.95 + 2.6 * k;
        const fx = (dd) => vx + (1350 - vx) / dd, fy = (dd) => vy + (1240 - vy) / dd;
        for (let i = 0; i < 26; i++) {                                      // his footprints behind him (generated prints)
          const dd = 0.95 + 0.1 * i; if (dd > d - 0.08) break;
          const sc = 1 / dd;
          footprint(ctx, env, 'top', 'his', i % 2 ? 'R' : 'L', fx(dd) + (i % 2 ? 16 : -16) * sc, fy(dd), 40 * sc, { a: 0 });
        }
        fig(ctx, env, hisWalk(t, B(83)), fit(env, 'yt_walk_away_0', fx(d), fy(d), 1000 / d), t, { seed: 191, shadow: false, breathe: 0 });
        snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 220, seed: 192 });
  };

  return [
    {
      id: 'c2-palm', at: B(73), palette: 'cold',
      moment: '"Me, my heart frozen": from outside the booth, her palm pressed to the frosted glass.',
      layout: 'the palm centred, the frost round it; the tube light behind; slow push',
      camera: (t) => { const d = drift(t, 170, 3), k = easeInOut(prog(t, B(73), B(74))); return { x: d.x, y: d.y, zoom: 1.0 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) { palm(ctx, t, u, 0); },
    },
    {
      id: 'c2-platform', at: B(74), palette: 'night',
      moment: 'Elsewhere, at the same moment: a night platform; the train pulls out and leaves him there, his back to us. He is on his way home.',
      layout: 'flat-on across the tracks: the train car on the near track pulls out right; behind it, on the platform, him walking left along it (rear three-quarter, face turned away)',
      camera: (t) => { const d = drift(t, 173, 3); return { x: d.x, y: d.y, zoom: 1.02, rot: d.rot }; },
      render(ctx, t, f, u) {
        if (!env.plates.has('bg_platform_across')) return;
        backdrop(ctx, env, 'bg_platform_across', { focus: [0.5, 0.5], zoom: 1.05 });
        // him on the platform, walking along it to the left towards the exit (rear three-quarter: his face turned away);
        // the train covers him, then pulls out to the right
        const k = prog(t, B(74), B(75)), side = `yt_walk_side_${Math.floor((t - B(74)) / (P / 4)) % 4}`;
        fig(ctx, env, side, fit(env, 'yt_walk_side_0', 1250 - 300 * k, 620, 340), t, { seed: 174, shadow: false, breathe: 0 });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 150, seed: 175 });
        const sz = env.plates.size('obj_train_car'), tw = 2700, th = (tw * sz.h) / sz.w, ty = 905 - th * 0.74;   // wheels on the near rails
        const tx = (tt) => -380 + 2700 * Math.pow(prog(tt, B(74) + 0.3, B(75) - 0.2), 2);
        ctx.trail(4, 0.02, (tau) => fig(ctx, env, 'obj_train_car', { x: tx(t - tau), y: ty, w: tw, h: th }, t, { shadow: false, breathe: 0 }), 0.5);
      },
    },
    {
      id: 'c2-melt', at: B(75), palette: (t) => ['cold', 'memory', easeOut(prog(t, tAtata - 0.2, tAtata + 1.2))], state: 'cold > memory (温)',
      moment: '"Warm me with your kindness": the frost melts out from her palm, and on 温 a warm amber light comes through the hole; the camera goes into it.',
      layout: 'the palm; the frost hole opening; amber light; push into the light',
      camera: (t) => { const d = drift(t, 176, 3), k = easeIn(prog(t, tAtata, B(77))); return { x: d.x, y: d.y + 40 * k, zoom: 1.0 + 1.6 * k, rot: d.rot }; },
      render(ctx, t, f, u) { palm(ctx, t, u, easeOut(prog(t, B(75), tAtata + 0.6)) * 0.35 + 0.65 * easeOut(prog(t, tAtata, tAtata + 1.4))); },
    },
    {
      id: 'c2-wire', at: B(77), palette: 'cold', enter: { type: 'circle', dur: 0.4, align: 'end' },
      moment: '"Even if I searched the whole world": along the telephone wire from one lit window to the next - a family, a couple, an old couple - and at the end of the wire, him, walking.',
      layout: 'a strip of night windows; the wire across the top of the frame; a whip pan every two beats; him at the end',
      camera: (t) => { const d = drift(t, 177, 3); return { x: d.x, y: d.y, zoom: 1.0 + 0.04 * ((t - B(77)) % (2 * P)) / (2 * P), rot: d.rot }; },
      render(ctx, t, f, u) {
        const draw = (sx) => {
          STRIP.forEach(([name, focus], i) => {
            const x0 = i * 2100 - sx;
            if (x0 > 2000 || x0 < -2200) return;
            ctx.at(x0, 0, () => {
              if (name === 'him') {
                ctx.withPal('night', () => {
                  hisStreet(ctx, env, t, hisWalk(t, Bt(315)), 1.6 + 1.0 * prog(t, Bt(315), Bt(318)), 178);
                  snow(ctx, t, { r: { x: -60, y: -40, w: 2100, h: 1160 }, count: 160, seed: 179 });
                });
              } else backdrop(ctx, env, name, { focus, zoom: 1.15, roles: WARM });
            });
          });
          // the wire: one sagging line across the whole strip, with its poles
          ctx.poly(Array.from({ length: 41 }, (_, i) => { const x = -60 + i * 52, gx = x + sx; return [x, 70 + 34 * Math.sin(((gx % 2100) / 2100) * Math.PI)]; }), { color: 'panel', width: 7 });
          ctx.poly(Array.from({ length: 41 }, (_, i) => { const x = -60 + i * 52, gx = x + sx; return [x, 67 + 34 * Math.sin(((gx % 2100) / 2100) * Math.PI)]; }), { color: 'ice', width: 2, alpha: 0.8 });   // the cold light on its top
        };
        const sx = stripX(t), moving = STOPS.some((s, i) => i && t > s - 0.3 && t < s);
        if (moving) ctx.trail(5, 0.02, (tau) => draw(stripX(t - tau)), 0.55); else draw(sx);
      },
    },
    {
      id: 'c2-scarf', at: Bt(318), palette: 'memory', enter: { type: 'fade', dur: 0.5, align: 'center' },
      moment: '"Nothing warmer than you": a memory - his hands wrapping the scarf round her neck from behind; she closes her eyes.',
      layout: 'her head and shoulders, his hands and sleeves; the warm room behind out of focus; slow push',
      camera: (t) => { const d = drift(t, 180, 3), k = easeInOut(prog(t, Bt(318), B(81))); return { x: d.x + 30 * k, y: d.y, zoom: 1.0 + 0.08 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        backdrop(ctx, env, 'bg_his_room_warm', { focus: [0.45, 0.45], zoom: 1.6, blur: 10 });
        dotLight(ctx, 900, 380, 900, 'youHot', { alpha: 0.3, cell: 12 });
        fig(ctx, env, 'yt_scarf', fit(env, 'yt_scarf', 980, 1240, 1300), t, { at: u.at, seed: 181 });
      },
    },
    {
      id: 'c2-him', at: B(81), palette: 'night',
      moment: 'Him, small under the street lamps, walking on through the snow.',
      layout: 'a high wide view down a street; him tiny, walking away; the lamps',
      camera: (t) => { const d = drift(t, 182, 3), k = easeInOut(prog(t, B(81), B(82))); return { x: d.x, y: d.y - 30, zoom: 1.08 - 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        hisStreet(ctx, env, t, hisWalk(t, B(81)), 2.6 + 1.8 * prog(t, B(81), B(82)), 183);
        snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 240, seed: 184 });
        nearSnow(ctx, t, { count: 4, seed: 185, alpha: 0.12 });
      },
    },
    {
      id: 'c2-card', at: B(82), palette: 'cold',
      moment: '"Surely there is nothing else": the units run down - 2.',
      layout: 'the phone close: LED left, slot right; the card comes up out of the slot; her hand takes it and lifts it',
      camera: (t) => { const d = drift(t, 186, 3), k = easeInOut(prog(t, B(82), B(83))); return { x: d.x + 60 * k, y: d.y, zoom: 1.0 + 0.08 * k + 0.02 * pulse(t - B(84), 7), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.3, cell: 13 });
        const P2 = panelAt(0.66, 0.24, 980, 440, 4600);
        fig(ctx, env, 'obj_phone_panel', P2.d, t, { at: u.at, seed: 187 });
        ledDigits(ctx, P2, units(env, t));
        if (t < B(84)) return;
        // the card pops out of the slit (only the card: her hand is not in this shot)
        const [sx0, sy] = P2.at(PANEL.slot.u0, PANEL.slot.v), [sx1] = P2.at(PANEL.slot.u1, PANEL.slot.v);
        const C = HOLD.card, cw = 0.97 * (sx1 - sx0), hw = cw / (C.u1 - C.u0), hh = (hw * 941) / 1672, ch = (C.v1 - C.v0) * hh;
        const out = easeOut(prog(t, B(84), B(84) + 0.3)) + 0.04 * Math.sin(Math.min(1, (t - B(84)) / 0.5) * Math.PI * 3) * (1 - prog(t, B(84), B(84) + 0.6));
        const topY = sy - 0.62 * ch * out, hx = sx0 + 0.015 * cw - C.u0 * hw, hy = topY - C.v0 * hh;
        const g = ctx.g;
        g.save(); g.beginPath(); g.rect(hx + C.u0 * hw - 4, topY - 4, cw / 0.97 + 8, sy - topY + 4); g.clip();     // the card above the slit, nothing else
        fig(ctx, env, 'h_card_hold', { x: hx, y: hy, w: hw, h: hh }, t, { seed: 188 });
        g.restore(); ctx._font = '';
      },
    },
    {
      id: 'c2-pass', at: B(83), palette: 'night',
      moment: 'The near miss (episode 4: she is on the public phone, he runs right past): the street of the intro. She is in the lit booth, eyes closed, leaving her message on his machine - and he walks past right outside, his back to us, and does not look. His footprints stay in the snow.',
      layout: 'the intro street MIRRORED (the booth left, clear of the lyric column), her in it; him walking away from the camera down the street past the booth',
      camera: (t) => { const d = drift(t, 189, 3), k = easeInOut(prog(t, B(83), B(84))); return { x: d.x - 110, y: d.y, zoom: 1.08 + 0.04 * k, rot: d.rot }; },
      render(ctx, t, f, u) { ctx.at(1920, 0, () => passBody(ctx, t, u), { sx: -1 }); },   // mirrored: the booth on the left, clear of the lyric column
    },
    {
      id: 'c2-card-out', at: B(84), palette: 'cold',
      moment: 'The units run out: 0. The phone pushes her card out.',
      layout: 'the phone close: LED left, slot right; the card comes up out of the slot; her hand takes it and lifts it',
      camera: (t) => { const d = drift(t, 186, 3), k = easeInOut(prog(t, B(84), Bt(339))); return { x: d.x + 60 * k, y: d.y, zoom: 1.0 + 0.08 * k + 0.02 * pulse(t - B(84), 7), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.3, cell: 13 });
        const P2 = panelAt(0.66, 0.24, 980, 440, 4600);
        fig(ctx, env, 'obj_phone_panel', P2.d, t, { at: u.at, seed: 187 });
        ledDigits(ctx, P2, units(env, t));
        if (t < B(84)) return;
        // the card pops out of the slit (only the card: her hand is not in this shot)
        const [sx0, sy] = P2.at(PANEL.slot.u0, PANEL.slot.v), [sx1] = P2.at(PANEL.slot.u1, PANEL.slot.v);
        const C = HOLD.card, cw = 0.97 * (sx1 - sx0), hw = cw / (C.u1 - C.u0), hh = (hw * 941) / 1672, ch = (C.v1 - C.v0) * hh;
        const out = easeOut(prog(t, B(84), B(84) + 0.3)) + 0.04 * Math.sin(Math.min(1, (t - B(84)) / 0.5) * Math.PI * 3) * (1 - prog(t, B(84), B(84) + 0.6));
        const topY = sy - 0.62 * ch * out, hx = sx0 + 0.015 * cw - C.u0 * hw, hy = topY - C.v0 * hh;
        const g = ctx.g;
        g.save(); g.beginPath(); g.rect(hx + C.u0 * hw - 4, topY - 4, cw / 0.97 + 8, sy - topY + 4); g.clip();     // the card above the slit, nothing else
        fig(ctx, env, 'h_card_hold', { x: hx, y: hy, w: hw, h: hh }, t, { seed: 188 });
        g.restore(); ctx._font = '';
      },
    },
    {
      id: 'c2-card-look', at: Bt(339) - 0.4, palette: 'cold',
      moment: 'She holds the empty card and looks at it: the call is over.',
      layout: 'her bust in the booth, the card in both hands at her chest; slow push',
      camera: (t) => { const d = drift(t, 193, 3), k = easeInOut(prog(t, Bt(339) - 0.4, B(85))); return { x: d.x, y: d.y + 20 * k, zoom: 1.02 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothInside(ctx, env, t, { focus: [0.62, 0.48], fogK: 0.6 });
        const name = kind(env, 'y_card_look') ? 'y_card_look' : 'y_wait_1';
        fig(ctx, env, name, fit(env, name, 720, 1110, 1040), t, { at: u.at, seed: 194 });
      },
    },
  ];
}

export function c2Sfx(env) {
  const { B } = cues(env);
  return [
    { t: B(74) + 0.3, kind: 'relay', rel: -16 },                        // the train doors / the car moving off
    { t: B(82), kind: 'hum', dur: B(84) - B(82), rel: -26 },
    { t: B(84), kind: 'beep', rel: -10, dur: 0.3 },                     // 0 units: the phone beeps
    { t: B(84) + 0.15, kind: 'card', rel: -10 },                        // and pushes the card out
  ];
}
