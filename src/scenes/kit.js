// What sections share: the lyric band (her words), ruby, the stagger helper.
//
// The lyric band (docs/PLAN.md §3): her Japanese line in Shippori Mincho, revealed character by character as it is
// sung (a quick rise + fade per character, evenly over the first part of the line), the Chinese line small beneath.
// Same place and size for the whole film unless a shot asks otherwise (shot.lyric = { x, y, align, size } or 'none').
import { clamp, easeOut, prog } from '../engine/util.js';
import { rand } from '../engine/prng.js';

/** '夢のような時間(とき)は' -> [{ base: '夢のような' }, { base: '時間', ruby: 'とき' }, { base: 'は' }] */
export function parseRuby(str) {
  const out = [], re = /([^()]+?)\(([^()]+)\)/g;
  let last = 0, m;
  // the base of a ruby group is the run of kanji right before '(' : split it off the preceding text
  while ((m = re.exec(str))) {
    const pre = m[1], kan = /[一-鿿々]+$/.exec(pre);
    const base = kan ? kan[0] : pre, before = pre.slice(0, pre.length - base.length);
    if (before) out.push({ base: before });
    out.push({ base, ruby: m[2] });
    last = re.lastIndex;
  }
  if (last < str.length) out.push({ base: str.slice(last) });
  return out;
}

export const BAND = { x: 150, y: 948, size: 54, zhSize: 25, gap: 16 };

/**
 * Her line i at time t. k = reveal progress is derived from the line's time: characters appear over
 * min(0.62 * duration, 0.32 s per character); the line fades out over 0.45 s before `until`.
 */
export function lyricBand(ctx, env, i, t, { x = BAND.x, y = BAND.y, size = BAND.size, zhSize = BAND.zhSize, align = 'left', until = null, color = 'text', zhColor = 'sub', mark = 'me', alpha = 1 } = {}) {
  const ly = env.lyrics, t0 = ly.start(i), t1 = until ?? ly.end(i);
  const a = alpha * Math.min(prog(t, t0 - 0.05, t0 + 0.2), 1 - prog(t, t1 - 0.45, t1));
  if (a <= 0.003) return;
  const parts = parseRuby(ly.lines[i].jp), chars = [];
  for (const p of parts) for (const [j, ch] of [...p.base].entries()) chars.push({ ch, ruby: j === 0 ? p.ruby : null, rubyLen: p.base.length });
  const n = chars.length, dur = Math.min(0.62 * (t1 - t0), 0.32 * n), step = dur / Math.max(1, n);
  const ws = chars.map((c) => ctx.measure(c.ch, { size, font: 'serif', weight: 600 }) + size * 0.02);
  const W = ws.reduce((s, w) => s + w, 0);
  let cx = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x;
  // her mark: a small wine block before the line (her colour, the only colour on the band)
  if (mark) ctx.rect(cx - size * 0.52, y - size * 0.62, size * 0.16, size * 0.62, { fill: true, color: mark, alpha: a });
  chars.forEach((c, j) => {
    const k = clamp((t - t0 - j * step) / 0.22), e = easeOut(k);
    if (k > 0) {
      ctx.text(c.ch, cx, y + (1 - e) * 10, { size, font: 'serif', weight: 600, color, alpha: a * e });
      if (c.ruby) ctx.text(c.ruby, cx + ws.slice(j, j + c.rubyLen).reduce((s, w) => s + w, 0) / 2, y - size * 0.98, { size: size * 0.36, font: 'serif', weight: 500, color, alpha: a * e * 0.85, align: 'center' });
    }
    cx += ws[j];
  });
  // the Chinese line: whole, after the first third of the Japanese has appeared
  const zk = easeOut(prog(t, t0 + dur * 0.3, t0 + dur * 0.3 + 0.5));
  const zx = align === 'center' ? x : align === 'right' ? x : x;
  ctx.text(ly.lines[i].zh, zx, y + zhSize + BAND.gap + 10, { size: zhSize, font: 'zh', color: zhColor, alpha: a * zk, align });
}

/** The lyric line shown at t: the last line whose start <= t and that has not ended (or -1). */
export function lineAt(env, t) {
  const i = env.lyrics.indexAt(t);
  if (i < 0) return -1;
  const next = i + 1 < env.lyrics.lines.length ? env.lyrics.start(i + 1) : Infinity;
  return t < Math.min(env.lyrics.end(i), next) ? i : -1;
}

// ---- the vertical lyric (docs/VISUAL.md §3.1) ----------------------------------------------------------------------
// Her line in a vertical column on the right, one character landing when it is sung (lines[i].chars[].t from
// tools/align_lyrics.py; until that exists the characters are spread over the first part of the line). The Chinese
// line stands beside it in small type. Up to three columns form a page (right to left); when the next page begins, or
// the section ends, the old columns break up into snow and fall.

export const COLUMN = { x: 1772, y: 150, size: 56, zhSize: 23, pitch: 150, rubySize: 20, lineH: 1.16 };

/**
 * One character of her words, printed so it reads on ANY ground (user review: the cream characters vanished on his
 * cream coat): a dark shadow plate out of register, a dark keyline, then the cream ink. Sizes scale with the type.
 */
export function printChar(ctx, ch, x, y, { size, weight = 600, color = 'text', alpha = 1, keyline = 'bg' }) {
  const k = size / 56;
  ctx.text(ch, x + 4 * k, y + 5 * k, { size, font: 'serif', weight, color: keyline, alpha: alpha * 0.85, align: 'center' });   // shadow plate
  ctx.text(ch, x, y, { size, font: 'serif', weight, color: keyline, alpha: alpha * 0.9, align: 'center', stroke: 7 * k });     // keyline
  ctx.text(ch, x, y, { size, font: 'serif', weight, color, alpha, align: 'center' });
}
const SMALL = new Set([...'ぁぃぅぇぉっゃゅょァィゥェォッャュョ、。']);
const VERT = { '「': '﹁', '」': '﹂' };

/** The characters of line i with their landing times. */
export function charTimes(env, i) {
  const ln = env.lyrics.lines[i];
  if (ln.chars?.length) return ln.chars.map((c) => ({ c: c.c, t: c.t + (env.cfg?.timing?.lyricOffset || 0) }));
  const parts = parseRuby(ln.jp), chars = parts.flatMap((p) => [...p.base]);
  const t0 = env.lyrics.start(i), t1 = env.lyrics.end(i), dur = Math.min(0.62 * (t1 - t0), 0.32 * chars.length);
  return chars.map((c, j) => ({ c, t: t0 + (j * dur) / Math.max(1, chars.length) }));
}

// ---- hero words (docs/STORYBOARD_v2.md §0): the only words that land on objects in the picture ------------------
// 黄昏 = the lightbox (L0), 寂 = the brush character that breaks into snow (L7), 恋色の空 = the slips on the wire (L25);
// the title 恋色空 on the fogged glass is not a sung line. While a hero word is on its object the column keeps its
// place but leaves it blank: the word is never printed twice. config.json -> heroWords overrides this list.
export const HERO_WORDS = [{ line: 0, text: '黄昏' }, { line: 7, text: '寂' }, { line: 25, text: '恋色の空' }];

/** Indices (into charTimes(env, i)) of the hero word of line i, or an empty set. */
export function heroIndex(env, i) {
  const out = new Set(), cs = charTimes(env, i);
  for (const h of env.cfg?.heroWords ?? HERO_WORDS) {
    if (h.line !== i) continue;
    const want = [...h.text];
    for (let j = 0; j + want.length <= cs.length; j++) {
      if (want.every((c, q) => cs[j + q].c === c)) { for (let q = 0; q < want.length; q++) out.add(j + q); break; }
    }
  }
  return out;
}
/** The hero characters of line i with their sung times: [{ c, t }] (the shot puts them on its object). */
export const heroChars = (env, i) => { const ix = heroIndex(env, i); return charTimes(env, i).filter((_, j) => ix.has(j)); };

/** Pages: which lines share a page with line i, its column, and when the page breaks up. */
export function pageOf(env, i) {
  const L = env.lyrics.lines, sec = L[i].section;
  let first = i;
  while (first > 0 && L[first - 1].section === sec) first--;
  const col = (i - first) % 3, pageStart = i - col;
  const nextIdx = pageStart + 3 < L.length && L[pageStart + 3]?.section === sec ? pageStart + 3 : null;
  let lastOfPage = Math.min(pageStart + 2, L.length - 1);
  while (L[lastOfPage].section !== sec) lastOfPage--;
  const after = nextIdx ?? (lastOfPage + 1 < L.length ? lastOfPage + 1 : null);
  const vocalEnd = (k) => L[k].vocalEnd ?? env.lyrics.end(k);
  // the page breaks up at the next page's first line, but never later than 3.5 s after its last line has been sung
  const breakAt = Math.min(after != null ? env.lyrics.start(after) - 0.2 : Infinity, vocalEnd(lastOfPage) + 3.5);
  return { col, pageStart, breakAt };
}

/** Draw every visible column at time t. opts: { x, y, size, color, zhColor, mark, alpha } */
export function lyricColumns(ctx, env, t, { x = COLUMN.x, y = COLUMN.y, size: size0 = COLUMN.size, color = 'text', zhColor = 'sub', mark = 'me', alpha = 1 } = {}) {
  const L = env.lyrics.lines;
  let size = size0;
  for (let i = 0; i < L.length; i++) {
    const cs = charTimes(env, i);
    if (!cs.length || t < cs[0].t - 0.2) continue;
    const { col, breakAt } = pageOf(env, i);
    if (t > breakAt + 3) continue;
    const cx = x - col * COLUMN.pitch;
    const n = cs.reduce((s2, c) => s2 + (c.c === ' ' || c.c === '　' ? 0.5 : 1), 0);
    size = Math.min(size0, (1080 - y - 70) / (n * COLUMN.lineH));       // a long line sets smaller rather than leave the page
    const newer = i + 1 < L.length && L[i + 1].section === L[i].section && pageOf(env, i + 1).col > col && t >= charTimes(env, i + 1)[0]?.t;
    const dim = newer ? 0.5 : 1;
    // her mark: a short wine rule above the column, drawn when the line starts
    if (mark) ctx.rect(cx - 3, y - 34, 6, 22 * easeOut(clamp((t - cs[0].t) / 0.3)), { fill: true, color: mark, alpha: alpha * dim * (t < breakAt ? 1 : 0) });
    let cy = y;
    const hero = heroIndex(env, i);                       // on an object in the picture: the column leaves them blank
    const ruby = parseRuby(L[i].jp);
    let ri = 0, rk = 0;                                   // walk ruby groups alongside the characters
    cs.forEach((c, j) => {
      const g = ruby[ri], isSmall = SMALL.has(c.c), ch = VERT[c.c] ?? c.c, step = c.c === ' ' || c.c === '　' ? 0.5 : 1;
      const k = clamp((t - c.t) / 0.18), e = easeOut(k);
      if (t < breakAt) {
        if (k > 0 && c.c.trim() && !hero.has(j)) {
          printChar(ctx, ch, cx + (isSmall ? size * 0.14 : 0), cy + size * 0.88 - (isSmall ? size * 0.12 : 0) - (1 - e) * 6, { size: isSmall ? size * 0.92 : size, color, alpha: alpha * dim * e });
          if (g?.ruby && rk === 0) {                              // ruby to the right of its base, as tall as the base
            const n = [...g.base].length, rs = COLUMN.rubySize, ry = cy + (n * size * COLUMN.lineH - [...g.ruby].length * rs) / 2;
            [...g.ruby].forEach((r, q) => printChar(ctx, r, cx + size * 0.62, ry + rs * (q + 0.9), { size: rs, weight: 500, color, alpha: alpha * dim * e * 0.9 }));
          }
        }
      } else if (c.c.trim() && !hero.has(j)) {                       // the page breaks up into snow
        const u = clamp((t - breakAt - j * 0.04) / 2.6);
        if (u < 1) for (let q = 0; q < 9; q++) {
          const ox = (rand(401, i, j, q) - 0.5) * size, oy = (rand(403, i, j, q) - 0.5) * size;
          const fx = cx + ox + Math.sin(u * 5 + q) * 14 + u * 60 * (rand(405, i, j, q) - 0.3), fy = cy + size * 0.5 + oy + u * u * 380 + u * 40;
          ctx.circle(fx, fy, (2.2 + 2.2 * rand(407, i, j, q)) * (1 - u * 0.5), { fill: true, color, alpha: alpha * dim * (1 - u) * 0.9 });
        }
      }
      cy += size * COLUMN.lineH * step;
      if (g) { rk++; if (rk >= [...g.base].length) { ri++; rk = 0; } }
    });
    // the Chinese line beside it, small, after the first third of the Japanese has landed
    const third = cs[Math.floor(cs.length / 3)]?.t ?? cs[0].t, zk = easeOut(clamp((t - third) / 0.5));
    if (env.cfg?.lyricsZh && t < breakAt && zk > 0) {                  // config.json lyricsZh: v1 is Japanese only
      let zy = y + 6;
      for (const zc of [...L[i].zh]) {
        if (zc === ' ') { zy += COLUMN.zhSize * 0.5; continue; }
        const vz = { '，': '︐', '。': '︒', '、': '︑', '…': '︙' }[zc] ?? zc;
        ctx.text(vz, cx - size * 0.95, zy + COLUMN.zhSize, { size: COLUMN.zhSize, font: 'zh', color: zhColor, alpha: alpha * dim * zk, align: 'center' });
        zy += COLUMN.zhSize * 1.12;
      }
    }
  }
}
