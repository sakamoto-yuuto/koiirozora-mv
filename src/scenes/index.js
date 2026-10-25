// Scene registry. The film is ONE phone call (docs/PLAN.md); sections are listed in story order.
// Each section file returns shot definitions (see shot.js); sequence() turns them into engine scenes.
// The overlay (her lyric band, the credits) is a separate scene on its own layer, drawn over every shot whose
// `lyric` is 'band' (default) or an options object; shots that set the line themselves say lyric: 'none'.
//
// Sections not written yet are covered by a plain placeholder per section (the lyric band on paper), so the film
// always runs end to end; they disappear as soon as a section file covers that time.
import { sequence } from './shot.js';
import { cues, SECTION } from './cues.js';
import { lyricColumns } from './kit.js';
import { ground } from '../components/plate.js';
import { snow } from '../components/world.js';
import { paper } from '../components/print.js';
import { clamp, prog } from '../engine/util.js';

/** [file, export] in film order. */
const SECTIONS = [
  ['./01_intro.js', 'introShots', 'introSfx'],          // 0:00  walk, card, number, rings, machine, ピー          snow > night
  ['./02_v1.js', 'v1Shots', 'v1Sfx'],                   // 1:15.8 V1: the message begins; dusk street, hands, the table   voice / memory
  ['./03_b1.js', 'b1Shots', 'b1Sfx'],                   // 1:40.2 B1: the counter, the platform, the fist               memory / voice
  ['./04_c1.js', 'c1Shots', 'c1Sfx'],                   // 2:02.6 C1 + post-chorus: frost, 寂, the receiver, montage     cold
  ['./05_brk.js', 'brkShots', 'brkSfx'],
  ['./06_v2.js', 'v2Shots', 'v2Sfx'],
  ['./07_b2.js', 'b2Shots', 'b2Sfx'],                   // 3:32.2 B2: she calls again; ふたりなら; もっともっと           voice / memory
  ['./08_c2.js', 'c2Shots', 'c2Sfx'],                   // 3:54.6 C2: the palm melts the frost; the wires; units 0      cold > voice
  ['./09_bridge.js', 'bridgeShots', 'bridgeSfx'],       // 4:33.0 bridge: she walks out under the wires                  night
  ['./10_c3.js', 'c3Shots', 'c3Sfx'],                   // 4:55.4 C3: the snow falls on her, outdoors                    cold
  ['./11_koi.js', 'koiShots', 'koiSfx'],                // 5:20.4 恋色の空: the only gradient of the film                koi
  ['./12_outro.js', 'outroShots', 'outroSfx'],          // 5:33.8 outro + end: back to his room; 再生; dawn              koi > dawn > dead
];

/** Placeholder per section: [id, at, state, note]. Removed where a section file has shots. */
const TODO = [
  ['v1', SECTION.v1 + 0.8, 'voice', 'V1: her message begins (walk at dusk, hands, two cups)'],
  ['b1', SECTION.b1, 'voice', 'B1: dream time passes; さよなら; the clenched glove'],
  ['c1', SECTION.c1, 'cold', 'C1: frost; 寂 falling like snow; 〔L11〕…'],
  ['post1', SECTION.post1, 'cold', 'post-chorus: units falling, the tape near its end'],
  ['brk', SECTION.brk, 'snow', 'BREAK: ピー, cut off; the receiver hangs'],
  ['v2', SECTION.v2, 'tv', 'V2: the TVs in the shop window: the festival broadcast'],
  ['b2', SECTION.b2, 'voice', 'B2: she dials again; ふたりなら; もっともっと'],
  ['c2', SECTION.c2, 'cold', 'C2: palm on the frost; the world of wires; units 0, the card comes out'],
  ['bridge', SECTION.bridge, 'night', 'bridge: she walks out along the telephone wire'],
  ['c3', SECTION.c3, 'cold', 'C3: no glass any more; snow on her'],
  ['koi', SECTION.title - 0.37, 'koi', '〔L26〕'],
  ['outro', SECTION.outro, 'koi', 'outro: the sky holds; back along the wire to his room'],
  ['fade', SECTION.fade, 'dawn', 'fade: 用件 2; an amber hand presses 再生'],
];

function placeholder(env, [id, at, state, note]) {
  return {
    id: `todo-${id}`, at, palette: state, moment: `(placeholder) ${note}`, layout: 'paper ground + lyric band',
    render(ctx, t) {
      ground(ctx, { tone: 'panel', light: [960, 420, 700, 'raised', 1] });
      snow(ctx, t, { count: 90, seed: 4, alpha: 0.5 });
      ctx.text(note, 960, 520, { size: 22, font: 'mono', color: 'mute', align: 'center' });
    },
  };
}

/** Every sound effect of the film, from the sections that have them (tools/sfx.mjs). */
export async function buildSfx(env) {
  const ev = [];
  for (const [file, , sfx] of SECTIONS) {
    if (!sfx) continue;
    try { const mod = await import(file); if (mod[sfx]) ev.push(...mod[sfx](env)); }
    catch (e) { if (!/Cannot find module|Failed to fetch|ERR_MODULE_NOT_FOUND/.test(String(e))) throw e; }   // section not written yet
  }
  return ev.sort((a, b) => a.t - b.t);
}

/** All shots in film order (also used by tools/storyboard.mjs). */
export async function buildShots(env) {
  const defs = [];
  for (const [file, fn] of SECTIONS) {
    try {
      const mod = await import(file);
      defs.push(...mod[fn](env));
    } catch (e) {
      console.warn(`[scenes] ${file} not used: ${e.message}`);
    }
  }
  const last = Math.max(...defs.map((d) => d.at));
  defs.push(...TODO.filter((p) => p[1] > last).map((p) => placeholder(env, p)));
  return sequence(defs, env.features.duration + 1);
}

/** The overlay: her lyric band over shots that want it, and the opening credit. */
function overlayScene(env, shots) {
  const content = shots.filter((s) => !s.overlay);
  const shotAt = (t) => { let s = null; for (const c of content) if (t >= c.start && t < c.end) s = c; return s; };
  return {
    id: 'overlay', overlay: true, start: -10, end: 1e6, enter: { type: 'cut' },
    render(ctx, t) {
      paper(ctx, { alpha: 0.075 });                                 // every frame is printed on paper
      // opening credit, top left in the night sky (the near snowbank covers the bottom of the frame), 1.2 - 12.2 s
      const ca = Math.min(prog(t, 1.2, 2.4), 1 - prog(t, 11.0, 12.2));
      if (ca > 0) {
        ctx.text('恋色空', 120, 140, { size: 46, font: 'serif', weight: 700, color: 'text', alpha: ca });
        ctx.text('森川由綺（CV：平野綾）', 120, 190, { size: 22, font: 'serif', color: 'sub', alpha: ca });
        ctx.text('作詞 Bee\'　作曲・編曲 藤間仁　TVアニメ WHITE ALBUM 挿入歌', 150, 986, { size: 17, font: 'serif', color: 'mute', alpha: ca });
      }
      const shot = shotAt(t), mode = shot?.lyric ?? 'column';
      if (mode !== 'none') lyricColumns(ctx, env, t, typeof mode === 'object' ? mode : {});
      shot?.screen?.(ctx, t);                                       // a shot's own type on the page (outside its camera)
    },
  };
}

export async function buildScenes(env, { lab = null } = {}) {
  if (lab) { const m = await import('./lab.js'); return sequence(m.labShots(env, lab), 1e6); }   // check cards instead of the film
  const shots = await buildShots(env);
  return [...shots, overlayScene(env, shots)];
}
