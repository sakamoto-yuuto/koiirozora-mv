// Intro (0:00 - 1:15.4): a winter night; she walks to the booth, writes the title in her breath, lifts the receiver,
// puts the card in (the LED is the film's first colour), dials; it rings in his empty room; the machine answers; ピー.
// docs/STORYBOARD_v2.md §1 + v2.1 (machine only by its own objects: no read-out panels, no subtitles).
// Every picture is a codex print (src/scenes/stage.js); code adds light, snow, parallax, camera and the LED digits.
//
// Beat map (node tools/beatmap.mjs 0 76):
//    0.00  street, wide, snow; two passers-by far down the street; slow push right            snow (grey)
//    1.81  beat 2: she walks in from the left, one step per half beat (4 drawings / step = 10 fps)
//    ~7    the near pole slides past (fastest layer), she passes behind it
//   12.21  beat 15: she reaches the booth door; 12.45 door; 12.61 she is inside, a shape behind the glass
//   13.81  BAR 4 the front glass: two breaths fog it (Bt 17, 19.2), her fingertip writes 恋色空 (Bt 20.2 - 23.4)
//   19.01  beat 23.5 inside: she lifts the receiver to her ear (2 drawings)
//   19.81  beat 24.5 the card goes in; 20.21 BAR 6 click: LED 50 = the first colour of the film   snow > night
//   23.41  BAR 7 the receiver at her ear, eyes lowered: the dial tone
//   25.81  beat 32 the keypad: one key per beat (9 digits, last 32.21); 28.21 wider, the LED above the keys
//   33.01  BAR 10 she waits; the line connects
//   36.21  BAR 11 - 55.41 the rings, one per bar, cut between her and his room:
//          B11 her (eyes open) · B12 his flat from outside, one dark window · B13 his room: from the empty coat
//          hook to the phone ringing on the low table · B14 her, eyes closed · B15 the phone + machine, close ·
//          B16 the lit booth alone in the street · B17 her, the last ring
//   58.61  BAR 18 the machine answers: click, the 留守 lamp, the reels turn (3 drawings, 10 fps)
//   61.81  BAR 19 her: she hears the greeting (y_listen 0), 64.5 eyes down (y_listen 1)
//   68.21  BAR 21 his dark room, the red lamp the only colour in it
//   71.41  BAR 22 her: one breath in (71.5 the second rest)
//   74.61  BAR 23 ピー: the 録音 lamp lights. Everything she says from here is on his tape.
import { cues, CUE } from './cues.js';
import { segDigits } from '../components/phone.js';
import { snow, fog, fingerText } from '../components/world.js';
import { dotLight, dotCone, dotRing, drift, nearSnow, beatEnv } from '../components/print.js';
import { fig, fit, backdrop, plateAt, kind } from './stage.js';
import { PANEL, KEYPOS, panelAt, ledDigits, boothInside } from './props.js';
import { tableUV, MUG_CM } from './02_v1.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, lerp, prog, pulse } from '../engine/util.js';

const NUMBER = '035721986';                      // his number, 03-572-1986, one digit per beat
export const INTRO = { NUMBER };
const DIAL = 25.81;                              // beat 32: first digit (the last is on beat 40, 32.21)

// ---- where things are inside the plates (u, v in 0..1 of the picture, measured on the codex sources) ------------
const STREET = { booth: [0.801, 0.271, 0.966, 0.813], glass: [0.855, 0.33, 0.955, 0.76] };
const ROOM = { phone: [0.4695, 0.6376], machine: [0.5365, 0.650], lamp: [0.559, 0.644], hook: [0.248, 0.170] };
const APT = { dark: [0.4964, 0.2784] };
const MACHINE = { lamp1: [0.175, 0.338], lamp2: [0.167, 0.441], r: 0.017 };
// THE public phone is one element (src/scenes/props.js); the hands are separate elements composited on it.
// the hands, measured on their pictures (u, v in 0..1): the index fingertip; the card (its rect and its top edge)
const PRESS = { tip: [0.207, 0.794] };                                // h_press_hand (= art_src/v2/h_press_hand4b)
const HOLD = { card: { u0: 0.217, u1: 0.569, v0: 0.096, v1: 0.459 } };   // h_card_hold: the card

export function introShots(env) {
  const { B, Bt, P } = cues(env);
  const ringN = (t) => Math.floor((t - CUE.ringFrom) / (4 * P));
  const ringK = (t) => { if (t < CUE.ringFrom || t >= CUE.answer) return -1; const k = (t - CUE.ringFrom) % (4 * P); return k < 1.0 ? k : -1; };   // 1 s on / the rest off
  const digit = (t) => { const i = Math.floor((t - DIAL) / P + 1e-6); return i >= 0 && i < NUMBER.length ? { i, since: t - DIAL - i * P } : null; };
  const lit = (t) => (t >= CUE.cardIn ? 1 : 0);
  // ---- shared pieces ---------------------------------------------------------------------------------------------
  const boothIn = (ctx, t, opts) => boothInside(ctx, env, t, opts);
  /** The rings spreading from a point (sound made visible as rings of dots). */
  const rings = (ctx, t, x, y, { color = 'ice', size = 1, alpha = 0.6 } = {}) => {
    const rk = ringK(t);
    if (rk < 0) return;
    for (let q = 0; q < 3; q++) { const k = clamp(rk * 1.3 - q * 0.24); if (k > 0 && k < 1) dotRing(ctx, x, y, (50 + 520 * k) * size, 22 * size, color, { alpha: alpha * (1 - k), cell: 10 }); }
  };
  /** Their two mugs, cold (no steam), left on his table next to the machine: seen again warm in V1 L3. */
  const coldMugs = (ctx, t, opt = {}) => {
    for (const [name, a] of [['o2_mug_cream', 0.12], ['o2_mug_amber', 0.24]]) {                 // left of the phone, where the table is free
      const [uu, vv] = tableUV(a, 0.55), [x, y, s] = plateAt(env, 'bg_his_room_night', uu, vv, opt), sz = env.plates.size(name);
      const crop = { x: 0, y: 0.36 * sz.h, w: sz.w, h: 0.64 * sz.h }, w = MUG_CM * 9.2 * s, h = (w * crop.h) / crop.w;
      fig(ctx, env, name, { x: x - w / 2, y: y - h * 0.88, w, h }, t, { crop, shadow: false });
    }
  };
  const ringShake = (t) => { const rk = ringK(t); return rk >= 0 && rk < 0.3 ? Math.sin(t * 150) * 2.5 * (1 - rk / 0.3) : 0; };
  /** obj_machine at time t: reels turn (3 drawings at 10 fps) once it has answered. */
  const machineFrame = (t) => `obj_machine_${t >= CUE.answer ? Math.floor((t - CUE.answer) * 10) % 3 : 0}`;
  const lamp = (ctx, x, y, r, on, t0, t) => {
    if (!on) return;
    const k = easeOut(clamp((t - t0) / 0.12));
    ctx.circle(x, y, r, { fill: true, color: 'err', alpha: k });
    dotLight(ctx, x, y, r * 7, 'err', { alpha: 0.5 * k + 0.25 * pulse(t - t0, 3), cell: 9 });
  };

  // ---- the walk ----------------------------------------------------------------------------------------------------
  const S = 2100 / 1672, PL = { x: -100, y: -60, w: 2100, h: 2100 * 1880 / 3344 };            // the street plate in world px
  const W = (u, v) => [PL.x + u * PL.w, PL.y + v * PL.h];
  const WALK = { from: 1.81, to: 12.21 };
  const camX = (t) => 120 * easeInOut(prog(t, 0, 13.81));
  const walkK = (t) => { const k = prog(t, WALK.from, WALK.to); return 0.12 * easeInOut(k) + 0.88 * k; };
  const herAt = (t) => { const k = walkK(t); return { x: lerp(-170, 1560, k), y: lerp(1015, 905, k), h: lerp(560, 470, k) }; };

  return [
    {
      id: 'intro-street', at: 0, palette: 'snow',
      moment: 'A winter night, 1986. She walks through the snow along an empty shopping street to the one lit phone booth.',
      layout: 'the street plate wide; booth right third; she walks left to right behind the near snowbank; a pole slides past close',
      camera: (t) => { const d = drift(t, 1, 5); return { x: d.x + camX(t), y: d.y, zoom: 1 + 0.04 * easeInOut(prog(t, 0, 13.81)), rot: d.rot }; },
      render(ctx, t) {
        const cx = camX(t);
        env.plates.draw(ctx, 'bg_street_night', PL);
        // far passers-by: an old man going left down the street, a couple further off going away
        const om = 15 * t, bob = (k) => -2 * Math.abs(Math.sin(t * 3.4 + k));
        fig(ctx, env, 'passers_a', fit(env, 'passers_a', 740 - om, 742 + bob(0), 96, { w: 870, h: 1540 }), t, { crop: { x: 2280, y: 190, w: 870, h: 1540 }, flip: true, shadow: false, alpha: 0.95 });
        fig(ctx, env, 'passers_b', fit(env, 'passers_b', 1040 + 6 * t, 712 + bob(1), 78, { w: 1180, h: 1470 }), t, { crop: { x: 1200, y: 50, w: 1180, h: 1470 }, shadow: false, alpha: 0.9 });
        // her: one drawing per 0.1 s, one step (four drawings) per half beat; she fades into the booth at the door
        const h = herAt(t), inBooth = t >= 12.61;
        if (t >= WALK.from - 0.3 && !inBooth) {
          const walking = t < WALK.to, f = walking ? Math.floor((t - WALK.from) / (P / 8)) % 4 : 2;
          const a = clamp((t - WALK.from + 0.3) * 3) * (1 - prog(t, 12.31, 12.61));
          fig(ctx, env, `y_walk_${f}`, fit(env, 'y_walk_0', h.x, h.y, h.h), t, { at: WALK.from, seed: 3, alpha: a, roles: { cream: 'sub', orange: 'me', black: 'bg' }, breathe: 0 });
        }
        if (inBooth) {                                                // a shape behind the frosted glass
          const [gx0, gy0] = W(STREET.glass[0], STREET.glass[1]), [gx1, gy1] = W(STREET.glass[2], STREET.glass[3]);
          ctx.clip({ x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0 }, () => fig(ctx, env, 'y_wait_0', fit(env, 'y_wait_0', gx0 + 0.55 * (gx1 - gx0), gy1 + 20, 0.7 * (gy1 - gy0)), t, { alpha: 0.55 * prog(t, 12.61, 13.1), roles: { cream: 'sub', orange: 'me', black: 'bg' } }));
          fog(ctx, { x: gx0, y: gy0 + 0.45 * (gy1 - gy0), w: gx1 - gx0, h: 0.55 * (gy1 - gy0) }, { k: 0.8, cell: 6, seed: 9 });
        }
        snow(ctx, t, { r: { x: -100, y: -60, w: 2240, h: 1200 }, count: 230, seed: 1, camX: cx });
        // the near layers, faster than the camera: the pole, then the snowbank over her feet
        ctx.at(-cx * 7.5, 0, () => fig(ctx, env, 'fg_pole_near', { x: 1260, y: -260, w: 760, h: 1350 }, t, { shadow: false }));
        ctx.at(-cx * 0.6, 0, () => fig(ctx, env, 'fg_snowbank_near', { x: -320, y: 122, w: 2620, h: 1123 }, t, { shadow: false }));
        nearSnow(ctx, t, { count: 6, seed: 2, alpha: 0.15 });
      },
    },
    {
      id: 'intro-fog-title', at: B(4), palette: 'snow',
      enter: { type: 'fade', dur: 0.8, align: 'center' },
      moment: 'Inside the booth she breathes on the glass and writes the title into the fog with a fingertip.',
      layout: 'the front glass fills the frame; the street out of focus behind; the title centre; her finger from below',
      camera: (t) => { const d = drift(t, 3, 6); return { x: d.x, y: d.y, zoom: 1 + 0.04 * easeInOut(prog(t, B(4), Bt(24))), rot: d.rot }; },
      render(ctx, t) {
        backdrop(ctx, env, 'bg_street_night', { focus: [0.42, 0.55], zoom: 1.25, blur: 7 });
        snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 120, seed: 7, size: 5, alpha: 0.5, speed: 40 });
        const breath = 0.5 + 0.3 * easeOut(prog(t, Bt(17), Bt(17.9))) + 0.3 * easeOut(prog(t, Bt(19.2), Bt(20)));
        const k = prog(t, Bt(20.2), Bt(23.4)), X = 960 - 405, Y = 640, SZ = 270;
        let tip = null;
        ctx.masked(() => {
          ctx.rect(-40, -40, 2000, 1160, { fill: true, color: 'sub', alpha: 0.55 * breath });
          fog(ctx, { x: -40, y: -40, w: 2000, h: 1160 }, { k: breath, seed: 5, cell: 7 });
        }, () => {
          ctx.rect(-40, -40, 2000, 1160, { fill: true, color: 'text' });
          ctx.g.globalCompositeOperation = 'destination-out';
          tip = fingerText(ctx, '恋色空', X, Y, { size: SZ, k, color: 'text' });
          ctx.g.globalCompositeOperation = 'source-over';
        });
        for (const b0 of [Bt(17), Bt(19.2)]) { const kb = prog(t, b0, b0 + 1.4); if (kb > 0 && kb < 1) dotLight(ctx, 900, 780 - 60 * kb, 260 + 200 * kb, 'text', { alpha: 0.5 * (1 - kb), cell: 9 }); }
        // her fingertip (art: h_finger_glass) leading the stroke, seen from outside through the glass
        if (tip && kind(env, 'h_finger_glass')) {
          const s = env.art ? 760 : 0;                                  // the hand is 760 px tall on screen
          const d = fit(env, 'h_finger_glass', 0, 0, s), tipU = 0.40, tipV = 0.02;
          fig(ctx, env, 'h_finger_glass', { x: tip[0] - tipU * d.w, y: tip[1] - tipV * d.h, w: d.w, h: d.h }, t, { seed: 5, roles: { cream: 'text', orange: 'me', black: 'bg' } });
        }
      },
    },
    {
      id: 'intro-lift', at: Bt(23.5), palette: 'snow',
      moment: 'She lifts the receiver.',
      layout: 'her waist-up profile in the booth, the phone at the left edge; the street out of focus behind',
      camera: (t) => { const d = drift(t, 4, 5); return { x: d.x, y: d.y, zoom: 1.02, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothIn(ctx, t);
        const fr = t < Bt(23.5) + 0.3 ? 1 : 2;                       // (frame 0 draws a phone of its own: not used)
        fig(ctx, env, `y_lift_${fr}`, fit(env, 'y_lift_0', 900, 1100, 1040), t, { at: u.at, seed: 21 });
      },
    },
    {
      id: 'intro-card', at: Bt(24.5), palette: (t) => (lit(t) ? 'night' : 'snow'), state: 'snow > night (on the LED, 20.21)',
      moment: 'The card goes into the phone. Click: the little window lights 50 - the units left on her card, and the first colour of the film.',
      layout: 'the phone close: LED window left, card slot right; her hand pushes the card up into the slot',
      camera: (t) => { const d = drift(t, 5, 4), k = easeInOut(prog(t, Bt(24.5), B(7))); return { x: d.x - 40 * k, y: d.y + 10 * k, zoom: 1 + 0.06 * k + 0.012 * pulse(t - CUE.cardIn, 8), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.3, cell: 13 });        // the tube light above
        const P = panelAt(0.735, 0.25, 1060, 440, 7200);                  // close on the slit, the LED window entering at the left
        fig(ctx, env, 'obj_phone_panel', P.d, t, { at: u.at, seed: 23 });
        if (lit(t)) { ledDigits(ctx, P, 50); ctx.flash(0.1 * pulse(t - CUE.cardIn, 5), 'err'); }
        if (!kind(env, 'h_card_hold')) return;
        // the hand: the card's top edge rises to the slit and into it; on the click the phone takes the card, the hand drops away
        const [sx0, sy] = P.at(PANEL.slot.u0, PANEL.slot.v), [sx1] = P.at(PANEL.slot.u1, PANEL.slot.v);
        const C = HOLD.card, cw = 0.97 * (sx1 - sx0), hw = cw / (C.u1 - C.u0), hh = hw * 941 / 1672, ch = (C.v1 - C.v0) * hh;
        const rise = easeOut(prog(t, Bt(24.5), CUE.cardIn - 0.08)), drop = easeInOut(prog(t, CUE.cardIn + 0.1, CUE.cardIn + 0.7));
        const topY = lerp(sy + 0.9 * ch, sy - 0.3 * ch, rise) + 1.4 * ch * drop;   // screen y of the card's top edge
        const hx = sx0 + 0.015 * cw - C.u0 * hw + 120 * drop, hy = topY - C.v0 * hh;
        const g = ctx.g;
        g.save(); g.beginPath(); g.rect(-200, -200, 2400, 1500);
        if (lit(t)) g.rect(hx + C.u0 * hw - 24, hy + C.v0 * hh - 24, cw + 48, ch + 48);              // swallowed: the whole card (and its shadow print) is inside
        else g.rect(sx0 - 6, sy - 2 * ch, sx1 - sx0 + 12, 2 * ch);                                    // the part above the slit is inside the phone
        g.clip('evenodd');
        fig(ctx, env, 'h_card_hold', { x: hx, y: hy, w: hw, h: hh }, t, { seed: 24, alpha: 1 - prog(t, CUE.cardIn + 0.35, CUE.cardIn + 0.6) });
        g.restore(); ctx._font = '';
      },
    },
    {
      id: 'intro-tone', at: B(7), palette: 'night',
      moment: 'The receiver at her ear, eyes lowered: the dial tone. She knows the number by heart.',
      layout: 'her profile in the booth, receiver at her ear; slow push in',
      camera: (t) => { const d = drift(t, 6, 5), k = easeInOut(prog(t, B(7), Bt(32))); return { x: d.x + 30 * k, y: d.y + 20 * k, zoom: 1.04 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothIn(ctx, t, { focus: [0.28, 0.48] });
        fig(ctx, env, 'y_lift_2', fit(env, 'y_lift_0', 900, 1100, 1040), t, { at: u.at, seed: 22 });
      },
    },
    ...[[Bt(32), 'keys', 'close on the keys: her finger lands on each key on the beat'], [Bt(35), 'panel', 'wider: the keypad and the LED window above it']].map(([at, k, layout]) => ({
      id: `intro-dial-${k}`, at, palette: 'night',
      moment: 'She dials his number, one key per beat.',
      layout,
      camera: (t) => { const d = drift(t, 7, 4), dg = digit(t); return { x: d.x, y: d.y, zoom: 1 + 0.01 * (dg ? pulse(dg.since, 9) : 0) + 0.025 * prog(t, at, at + 3), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 900, 0, 1100, 'ice', { alpha: 0.3, cell: 13 });
        const P = k === 'keys' ? panelAt(0.562, 0.408, 820, 560, 3300) : panelAt(0.56, 0.35, 900, 540, 2100);
        fig(ctx, env, 'obj_phone_panel', P.d, t, { at: u.at, seed: 31 });
        ledDigits(ctx, P, 50);
        const dg = digit(t);
        if (!dg) return;
        const [kc, kr] = KEYPOS[NUMBER[dg.i]], [kx, ky] = P.at(...PANEL.key(kc, kr)), kw = PANEL.keyW * P.d.w;
        const down = dg.since < 0.16 ? 1 : 1 - easeOut(clamp((dg.since - 0.16) / 0.22));   // lands on the beat, lifts after
        ctx.rect(kx - kw / 2, ky - kw / 2, kw, kw, { fill: true, color: 'bg', alpha: 0.4 * down });   // the key goes down
        if (kind(env, 'h_press_hand')) {
          const hw = 11 * kw, hh = hw * 941 / 1672, lift = (1 - down) * 0.5 * kw;
          fig(ctx, env, 'h_press_hand', { x: kx - PRESS.tip[0] * hw + 0.6 * lift, y: ky - PRESS.tip[1] * hh - lift, w: hw, h: hh }, t, { seed: 33, breathe: 0 });
        }
      },
    })),
    {
      id: 'intro-wait', at: B(10), palette: 'night',
      moment: 'The last digit. She waits for the line to connect.',
      layout: 'her three-quarter bust in the booth, receiver at her ear, eyes open',
      camera: (t) => { const d = drift(t, 8, 5); return { x: d.x, y: d.y, zoom: 1.02 + 0.03 * prog(t, B(10), B(11)), rot: d.rot }; },
      render(ctx, t, f, u) {
        boothIn(ctx, t, { focus: [0.62, 0.5] });
        fig(ctx, env, 'y_wait_0', fit(env, 'y_wait_0', 1000, 1100, 1000), t, { at: u.at, seed: 41 });
      },
    },
    // ---- the rings ------------------------------------------------------------------------------------------------
    ...[[11, 'her'], [12, 'flat'], [13, 'room'], [14, 'her2'], [15, 'table'], [16, 'street'], [17, 'her3']].map(([b, kindOf]) => ({
      id: `intro-ring-${kindOf}`, at: B(b), palette: ['flat', 'room', 'table'].includes(kindOf) ? 'snow' : 'night',
      moment: { her: 'It rings. She waits, the receiver at her ear.', flat: 'His flat: every window lit but one. The phone rings in the dark one.', room: 'His room, dark and empty - the coat hook by the door is empty. On the low table the phone rings.', her2: 'She closes her eyes and waits.', table: 'The phone ringing next to his answering machine.', street: 'The only lit box in the snowy street, ringing.', her3: 'The last ring.' }[kindOf],
      layout: { her: 'her bust, ring rings at her ear', flat: 'the apartment block, push in to the dark window', room: 'pan from the empty coat hook to the low table', her2: 'closer on her, eyes closed', table: 'phone + machine on the table, close', street: 'the street plate, the lit booth, pulling back', her3: 'her profile, close' }[kindOf],
      camera: (t) => {
        const d = drift(t, b, 5), k = easeInOut(prog(t, B(b), B(b + 1))), sh = ringShake(t);
        if (kindOf === 'room') return { x: d.x - 520 + 520 * k + sh, y: d.y, zoom: 1.25, rot: d.rot };
        if (kindOf === 'flat') return { x: d.x, y: d.y - 60 * k, zoom: 1 + 0.18 * k, rot: d.rot };
        if (kindOf === 'street') return { x: d.x + 260 - 120 * k, y: d.y - 40, zoom: 1.55 - 0.25 * k, rot: d.rot };
        return { x: d.x + sh, y: d.y, zoom: (kindOf === 'her2' ? 1.1 : kindOf === 'her3' ? 1.18 : 1.02) + 0.03 * k, rot: d.rot };
      },
      render(ctx, t, f, u) {
        if (kindOf === 'flat') {
          backdrop(ctx, env, 'bg_his_apt_ext');
          const [x, y] = plateAt(env, 'bg_his_apt_ext', APT.dark[0], APT.dark[1]);
          rings(ctx, t, x, y, { color: 'sub', size: 0.6, alpha: 0.35 });
          snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 200, seed: 12 });
          return;
        }
        if (kindOf === 'room' || kindOf === 'table') {
          const opt = kindOf === 'table' ? { focus: [0.5, 0.64], zoom: 2.1 } : {};
          backdrop(ctx, env, 'bg_his_room_night', opt);
          coldMugs(ctx, t, opt);
          const [x, y] = plateAt(env, 'bg_his_room_night', ROOM.phone[0], ROOM.phone[1], opt);
          rings(ctx, t, x, y, { color: 'text', size: kindOf === 'table' ? 1.4 : 0.9, alpha: 0.55 });
          return;
        }
        if (kindOf === 'street') {
          backdrop(ctx, env, 'bg_street_night', { focus: [0.8, 0.5] });
          const [x, y] = plateAt(env, 'bg_street_night', 0.9, 0.5, { focus: [0.8, 0.5] });
          rings(ctx, t, x, y, { color: 'ice', size: 0.7, alpha: 0.45 });
          snow(ctx, t, { r: { x: -60, y: -40, w: 2040, h: 1160 }, count: 260, seed: 31 });
          return;
        }
        boothIn(ctx, t, { focus: kindOf === 'her' ? [0.6, 0.5] : [0.3, 0.45] });
        const blink = kindOf === 'her' && ((t - B(b)) % 2.4) > 2.24;
        const name = kindOf === 'her' ? (blink ? 'y_wait_1' : 'y_wait_0') : kindOf === 'her2' ? 'y_wait_1' : 'y_smile_0';
        const dst = kindOf === 'her3' ? fit(env, name, 940, 1180, 1250) : fit(env, name, 1000, 1100, 1000);
        fig(ctx, env, name, dst, t, { at: u.at, seed: b });
        rings(ctx, t, dst.x + 0.3 * dst.w, dst.y + 0.38 * dst.h, { color: 'ice', size: 0.55, alpha: 0.6 });
      },
    })),
    // ---- the machine -----------------------------------------------------------------------------------------------
    ...[[CUE.answer, 'answer'], [CUE.beep, 'beep']].map(([at, k]) => ({
      id: `intro-machine-${k}`, at, palette: 'night',
      moment: k === 'answer' ? 'Click. His answering machine answers: the 留守 lamp lights and the reels start to turn.' : 'ピー. The 録音 lamp: from now on everything she says is on his tape.',
      layout: 'the answering machine close, reels in the window, lamps on the left',
      camera: (t) => { const d = drift(t, 19, 4), kk = prog(t, at, at + 3.2); return { x: d.x - 60 * kk, y: d.y, zoom: 1 + 0.05 * kk + (k === 'beep' ? 0.02 * pulse(t - at, 6) : 0), rot: d.rot }; },
      render(ctx, t, f, u) {
        ctx.rect(-60, -40, 2040, 1160, { fill: true, color: 'bg' });
        dotLight(ctx, 1500, 120, 900, 'ice', { alpha: 0.28, cell: 13 });         // the snow light from his window
        const name = machineFrame(t), w = 1700, h = w * 944 / 1162, x = 960 - w / 2, y = 540 - h / 2;
        fig(ctx, env, name, { x, y, w, h }, t, { at: u.at, seed: 51 });
        const r = MACHINE.r * w, l1 = [x + MACHINE.lamp1[0] * w, y + MACHINE.lamp1[1] * h], l2 = [x + MACHINE.lamp2[0] * w, y + MACHINE.lamp2[1] * h];
        lamp(ctx, l1[0], l1[1], r, t >= CUE.answer, CUE.answer, t);
        lamp(ctx, l2[0], l2[1], r, t >= CUE.beep, CUE.beep, t);
        ctx.text('留守', l1[0] + 2.2 * r, l1[1] + r * 0.6, { size: 1.6 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.8 });
        ctx.text('録音', l2[0] + 2.2 * r, l2[1] + r * 0.6, { size: 1.6 * r, font: 'serif', weight: 600, color: 'bg', alpha: 0.8 });
      },
    })),
    {
      id: 'intro-listen', at: B(19), palette: 'night',
      moment: 'She hears his recorded greeting: he is not there. She lowers her eyes.',
      layout: 'her three-quarter bust in the booth',
      camera: (t) => { const d = drift(t, 20, 5), k = easeInOut(prog(t, B(19), B(21))); return { x: d.x - 20 * k, y: d.y + 10 * k, zoom: 1.04 + 0.06 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothIn(ctx, t, { focus: [0.6, 0.48], fogK: 0.6 });
        fig(ctx, env, t < CUE.hush1 ? 'y_listen_0' : 'y_listen_1', fit(env, 'y_listen_0', 980, 1100, 1010), t, { at: u.at, seed: 61 });
      },
    },
    {
      id: 'intro-dark-room', at: B(21), palette: 'snow',
      moment: 'His room in the dark, the greeting playing to nobody; the red lamp is the only colour in it.',
      layout: 'his room wide, push in towards the low table',
      camera: (t) => { const d = drift(t, 21, 4), k = easeInOut(prog(t, B(21), B(22))); return { x: d.x + 40 * k, y: d.y + 50 * k, zoom: 1 + 0.12 * k, rot: d.rot }; },
      render(ctx, t) {
        backdrop(ctx, env, 'bg_his_room_night');
        coldMugs(ctx, t);
        const [x, y, s] = plateAt(env, 'bg_his_room_night', ROOM.lamp[0], ROOM.lamp[1]);
        ctx.withPal('night', () => { ctx.circle(x, y, 3.5 * s, { fill: true, color: 'err' }); dotLight(ctx, x, y, 60 * s, 'err', { alpha: 0.5, cell: 8 }); });
      },
    },
    {
      id: 'intro-breath', at: B(22), palette: 'night',
      moment: 'Silence. She takes one breath before she speaks.',
      layout: 'her bust close, the breath a cloud of dots',
      camera: (t) => { const d = drift(t, 22, 4), k = easeInOut(prog(t, B(22), B(23))); return { x: d.x, y: d.y, zoom: 1.12 + 0.05 * k, rot: d.rot }; },
      render(ctx, t, f, u) {
        boothIn(ctx, t, { focus: [0.62, 0.5], fogK: 0.7 });
        const inh = Math.sin(clamp((t - CUE.hush2) / 2.4) * Math.PI);           // the shoulders rise with the breath in
        const dst = fit(env, 'y_listen_1', 980, 1110 - 14 * inh, 1010);
        fig(ctx, env, 'y_listen_1', dst, t, { at: u.at, seed: 62 });
        const kb = prog(t, B(22) + 0.5, B(22) + 2.6);
        if (kb > 0 && kb < 1) dotLight(ctx, dst.x + 0.2 * dst.w, dst.y + 0.42 * dst.h + 40 * kb, 120 + 160 * kb, 'text', { alpha: 0.4 * (1 - kb), cell: 8 });
      },
    },
  ];
}

/**
 * Sound effects of this section (tools/sfx.mjs -> data/sfx.json -> tools/make_sfx.py). rel = dB RELATIVE to the local
 * loudness of the music (docs/VISUAL.md §5). The glass-wiping squeak of v1 is gone (user review).
 */
export function introSfx(env) {
  const { B, Bt, P } = cues(env), ev = [];
  for (let ts = 1.81; ts < 12.21; ts += P / 2) ev.push({ t: ts, kind: 'step', rel: -13, pan: -0.6 + 1.1 * (ts - 1.81) / (12.21 - 1.81) });
  ev.push({ t: 12.45, kind: 'door', rel: -11, pan: 0.45 });
  ev.push({ t: 13.01, kind: 'hum', dur: 7.2, rel: -28 });
  ev.push({ t: Bt(17), kind: 'breath', rel: -16 }, { t: Bt(19.2), kind: 'breath', rel: -16 });
  ev.push({ t: Bt(23.5), kind: 'lift', rel: -9 });
  ev.push({ t: CUE.cardIn - 0.3, kind: 'card', rel: -10, pan: 0.2 });
  ev.push({ t: CUE.cardIn + 0.25, kind: 'dialtone', dur: DIAL - CUE.cardIn - 0.3, rel: -20 });
  NUMBER.split('').forEach((d, i) => ev.push({ t: DIAL + i * P, kind: 'dtmf', key: d, rel: -14 }, { t: DIAL + i * P, kind: 'key', rel: -12 }));
  const room = { 12: -20, 13: -15, 15: -15 };                    // in his flat the bell (from outside: further away)
  for (let b = 11; b < 18; b++) ev.push(room[b] ? { t: B(b), kind: 'bell', rel: room[b], pan: 0.35 } : { t: B(b), kind: 'ringback', rel: b === 16 ? -22 : -16 });
  ev.push({ t: CUE.answer, kind: 'relay', rel: -10 }, { t: CUE.answer + 0.25, kind: 'tape', dur: CUE.beep - CUE.answer - 0.2, rel: -24 });
  ev.push({ t: CUE.beep, kind: 'beep', rel: -6 });
  return ev;
}
