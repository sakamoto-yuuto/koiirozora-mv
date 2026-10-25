// 恋色の空 (320.21 – 333.81): line 25. THE moment of the film (docs/PLAN.md §6 row 15; STORYBOARD_v2 v2.2).
// Beat map (node tools/beatmap.mjs 318 334):
//   320.14 見 · 320.21 beat 400 = CUT · 321.01 BAR 100 the tilt starts · 326.72 恋 = the sky begins to turn, slip 1 lands ·
//   327.22 色 slip 2 · 329.81 の slip 3 · 330.25 空 slip 4, the sky is complete · 330.61 BAR 103 hold, the slips sway ·
//   332.21 CUT (BAR 103 + 2 beats): him, at the foot of his stairs, looks up at the same sky · 333.81 BAR 104 outro.
// Lyrics: the shared right column (見上げたなら as sung); 恋色の空 are hero words: on the slips, blank in the column.
// The picture: she looks up (y_profile_up), the camera tilts with her gaze from the street to the sky past a utility pole
// (fg_pole_near) whose wires run on across the sky; snow falls TOWARDS the lens. On 恋 the sky starts to blend her wine
// and his amber - the only smooth gradient of the film - one step on each character; 恋色の空 hang on the middle wire as
// paper slips (obj_tanzaku, the characters printed in code). Then the same sky over him: his head goes up (yt_back_bust ->
// yt_look_up).
import { cues } from './cues.js';
import { heroChars } from './kit.js';
import { fig, fit, kind } from './stage.js';
import { dotLight, misreg, drift } from '../components/print.js';
import { rand } from '../engine/prng.js';
import { clamp, easeInOut, easeOut, easeBack, lerp, prog } from '../engine/util.js';

const LINE = 25;
// the pole, where it stands when the tilt is over (screen px; the plate is 1882 x 3344): its wires leave the right edge of
// the picture at these plate rows, with these slopes (measured on the plate), and run on in code to the next poles
const POLE = { x: -420, y: 30, h: 1800, par: 0.6 };
const EXITS = [
  { v: 563, slope: -0.19, to: [2150, -300], len: 520, width: 10 },      // A: the top wire, rising away
  { v: 792, slope: 0.175, to: [2150, 330], len: 620, width: 10 },       // B: the middle wire - the slips hang on it
  { v: 1368, slope: 0.55, to: [1350, 1400], len: 360, width: 9 },       // C: the service drop, down out of the frame
];
// the slip picture (obj_tanzaku, 2172 x 2896): cropped to the slip; the top of its string (where it hangs) and its paper
// face, in 0..1 of the crop
const SLIP = { crop: { x: 847, y: 246, w: 511, h: 2201 }, top: [0.515, 0.004], face: { u0: 0.018, v0: 0.148, u1: 0.916, v1: 0.979 } };

/** Snow seen from below: flakes come out of a vanishing point near the top and grow as they near the lens. */
function snowUp(ctx, t, { vp = [960, 120], count = 150, seed = 61, color = 'text', alpha = 0.9 } = {}) {
  const g = ctx.g;
  g.fillStyle = ctx.col(color, alpha);
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const speed = 0.11 + 0.09 * rand(seed, i, 1), z = 0.3 + 0.7 * ((rand(seed, i, 2) + t * speed) % 1);   // no pile-up at the vanishing point
    const a = rand(seed, i, 3) * 6.283, spread = 0.45 + 0.55 * rand(seed, i, 4);
    const r = Math.pow(z, 2.2) * 1500 * spread, sway = Math.sin(t * 0.9 + i) * 18 * z;
    const x = vp[0] + Math.cos(a) * r + sway, y = vp[1] + Math.sin(a) * r * 0.75 + z * 140;
    const s = 0.8 + 9 * Math.pow(z, 2.4);
    if (x < -40 || x > 1960 || y < -40 || y > 1120) continue;
    g.moveTo(x + s, y); g.arc(x, y, s, 0, 6.2832);
  }
  g.fill();
}

/** THE sky: night first, then the gradient, rising from the horizon as k goes 0 -> 1. */
function koiSkyFill(ctx, k) {
  ctx.rect(-60, -60, 2040, 1200, { fill: true, color: 'bg' });
  if (k > 0) {
    const h = 1080 * (0.55 + 0.45 * k);
    ctx.gradRect(-60, 1080 - h - 60, 2040, h + 120, [[0, 'bg', 0], [0.25, 'me', 0.55 * k], [0.6, 'koi', 0.85 * k], [1, 'you', 0.95 * k]]);
  }
  if (k < 1) dotLight(ctx, 960, 1180, 1300, 'ice', { sy: 0.45, alpha: 0.55 * (1 - k), cell: 12 });   // the city's cold glow, below
}

/** A wire on from point e with slope s at e (so it joins the wire drawn in the plate without a kink) to `to`, sagging in
 * the wind except at its ends; drawn thinner as it goes away. Returns its point at u (0..1). */
function wireOn(e, slope, to, len) {
  const c = [e[0] + len, e[1] + len * slope];
  return (u, t = 0, k = 0) => {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
    return [a * e[0] + b * c[0] + d * to[0], a * e[1] + b * c[1] + d * to[1] + Math.sin(u * Math.PI) * 7 * Math.sin(t * 0.8 + k)];
  };
}
function drawWire(ctx, at, t, k, w0) {
  for (let i = 0; i < 24; i++) {
    const p = at(i / 24, t, k), q = at((i + 1) / 24, t, k);
    ctx.line(p[0], p[1], q[0] + (q[0] - p[0]) * 0.04, q[1] + (q[1] - p[1]) * 0.04, { color: 'bg', width: lerp(w0, w0 * 0.35, i / 24) });
  }
}

/** A tanzaku: the paper slip picture hanging from (x, y) by its string, rotated by sway; ch printed on it. */
function slip(ctx, env, t, x, y, ch, { drop = 1, sway = 0, h = 470, seed = 0 } = {}) {
  const k = easeBack(clamp(drop)), a = clamp(drop * 4);
  if (!(a > 0)) return;
  const w = (h * SLIP.crop.w) / SLIP.crop.h, f = SLIP.face;
  ctx.at(x, y - (1 - k) * 120, () => {
    const ox = -SLIP.top[0] * w, oy = -SLIP.top[1] * h;
    if (kind(env, 'obj_tanzaku')) fig(ctx, env, 'obj_tanzaku', { x: ox, y: oy, w, h }, t, { seed, alpha: a, crop: SLIP.crop });
    else ctx.rect(ox + f.u0 * w, oy + f.v0 * h, (f.u1 - f.u0) * w, (f.v1 - f.v0) * h, { fill: true, color: 'text', alpha: a });
    const fw = (f.u1 - f.u0) * w, fh = (f.v1 - f.v0) * h, size = fw * 0.74;
    ctx.text(ch, ox + ((f.u0 + f.u1) / 2) * w - fw * 0.03, oy + f.v0 * h + fh * 0.36 + size * 0.36, { size, font: 'serif', weight: 700, color: 'bg', alpha: a, align: 'center' });
  }, { rot: sway });
}

export function koiShots(env) {
  const { B, P } = cues(env);
  const slips = heroChars(env, LINE);                              // 恋 色 の 空: on the slips, blank in the column
  const tKoi = slips[0].t, tSora = slips[slips.length - 1].t, tHim = B(103) + 2 * P;
  // the sky ratchets: one step per character, each step eased over 0.6 s (it never steps back)
  const skyK = (t) => slips.reduce((k, c, i) => Math.max(k, (i + easeOut(clamp((t - c.t) / 0.6))) / slips.length), 0);
  const tiltK = (t) => easeInOut(prog(t, B(100), tKoi + 0.4));          // street -> sky
  const rise = (t) => 1150 * (1 - tiltK(t)) - 140 * prog(t, tKoi + 0.4, B(104));   // how far below the sky the camera still looks

  // the pole plate's scale and the wires out of it (end-of-tilt screen px)
  const ps = POLE.h / 3344, pw = 1882 * ps;
  const wires = EXITS.map((e) => ({ ...e, at: wireOn([POLE.x + pw, POLE.y + e.v * ps], e.slope, e.to, e.len) }));

  return [{
    id: 'koi-sky', at: B(100) - 0.8,
    palette: (t) => (t < tKoi ? 'cold' : ['cold', 'koi', clamp(skyK(t) * 1.15)]), state: 'cold > koi (on 恋, one step per character)',
    moment: 'She looks up; the camera follows her gaze past a telephone pole to the sky. On 恋 the sky takes its colour - his amber and her wine blended for the first time - and 恋色の空 hang on the wire.',
    layout: 'tilt up from her profile (bottom right) past the pole (left) to the sky; four slips on the middle wire',
    camera: (t) => { const d = drift(t, 25, 5), hold = easeInOut(prog(t, tSora, tHim)); return { x: d.x - 60 * hold, y: d.y + 40 * hold, zoom: 1.02 - 0.02 * tiltK(t) + 0.07 * hold, rot: d.rot * 0.5 }; },
    render(ctx, t, f, u) {
      const r = rise(t);
      koiSkyFill(ctx, skyK(t));
      // the pole and its wires (one layer: the wires stay on its insulators), sliding down as the camera tilts up
      ctx.at(0, -r * POLE.par, () => {
        wires.forEach((w, k) => drawWire(ctx, w.at, t, k, w.width));
        fig(ctx, env, 'fg_pole_near', { x: POLE.x, y: POLE.y, w: pw, h: POLE.h }, t, { at: u.at, seed: 31 });
        // the slips hang on the middle wire, one per sung character
        slips.forEach((c, i) => {
          const [x, y] = wires[1].at(0.2 + i * 0.15, t, 1);
          slip(ctx, env, t, x, y - 4, c.c, { drop: (t - c.t) / 0.45, seed: 40 + i, sway: 0.07 * Math.sin(t * 1.3 + i * 1.7) + 0.03 * Math.sin(t * 3.1 + i) });
        });
      });
      // her, close, bottom right, looking up (nearest layer: slides out fastest)
      const hy = 300 + (1150 - r) * 1.25;
      if (hy < 1100) {
        const off = misreg(t, 33, { base: 5, kick: 14, cut: u.at });
        env.art.inks(ctx, 'y_profile_up', { x: 1080, y: hy, w: 860, h: 1147 }, { roles: { cream: 'text', orange: 'me', black: 'bg' }, offset: { black: off } });
      }
      snowUp(ctx, t, { vp: [900, 140], alpha: 0.85 });
    },
  }, {
    id: 'koi-him', at: tHim, palette: 'koi',
    moment: 'At the same moment he, at the foot of his stairs, lifts his head and looks up at the same sky.',
    layout: 'low angle from behind him: his head and shoulders bottom left, the same coloured sky over him, one wire across, snow',
    camera: (t) => { const d = drift(t, 41, 4), k = easeInOut(prog(t, tHim, B(104))); return { x: d.x, y: d.y + 30 * k, zoom: 1.0 + 0.05 * k, rot: d.rot * 0.5 }; },
    render(ctx, t, f, u) {
      koiSkyFill(ctx, 1);
      drawWire(ctx, wireOn([-80, 250], -0.12, [2050, 60], 900), t, 3, 6);
      const name = t < tHim + 0.45 || !kind(env, 'yt_look_up') ? 'yt_back_bust' : 'yt_look_up';
      fig(ctx, env, name, fit(env, 'yt_back_bust', 600, 1150, 980), t, { at: u.at, seed: 43 });
      snowUp(ctx, t, { vp: [1100, 160], alpha: 0.85, seed: 62 });
    },
  }];
}

export function koiSfx() { return []; }        // the music carries this moment alone
