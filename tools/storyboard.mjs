// Generates STORYBOARD.md from the live shot list (so the table can never drift from the code)
// and checks: every lyric line is shown by a shot, every cut sits on the beat grid, every shot
// states which moment of the conversation it is, and no stretch is still a fallback shot.
// It also stamps the viewer-facing flash range (film time = song time + safety.preroll) into README.md,
// between the <!-- flash-range --> markers, so that range is computed and never typed.
//   node tools/storyboard.mjs
// The section modules are imported under Node: neither they nor the shared modules may touch the DOM while a
// shot list is built, and whatever a method of `art` returns there is null (see the stub below).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Features } from '../src/engine/features.js';
import { Lyrics } from '../src/engine/lyrics.js';
import { buildShots } from '../src/scenes/index.js';
import { flashRangeText } from '../src/scenes/overlay.js';
import { ensureLyrics } from './fill_lyrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return fallback; } };
try { ensureLyrics({ quiet: true }); } catch (e) { console.error(e.message); process.exit(1); }   // data/lyrics.json from your own lyric file
const cfg = read('config.json');
const features = new Features(read(cfg.paths.features), cfg);
const lyrics = new Lyrics(read(cfg.paths.lyrics), cfg, features);
// section files only touch `art` while rendering, so a stub is enough to build the shot list
const art = new Proxy({}, { get: () => () => null });
const shots = await buildShots({ cfg, features, lyrics, art, script: read(cfg.paths.script, {}), errors: read(cfg.paths.errors, {}) });

const PRE = cfg.safety.preroll ?? 0;                   // the film starts this long before the song; times in the table are SONG time
const tc = (t) => { const a = Math.abs(t), m = Math.floor(a / 60), s = a - m * 60; return `${t < -1e-6 ? '−' : ''}${m}:${s.toFixed(2).padStart(5, '0')}`; };
const beat = (t) => (t - features.t0) / features.period;
const pos = (t) => {                                    // bar:beat position of a cut, to show it sits on the grid
  if (t < 0) return '歌曲前';
  if (t === 0) return '0:1';
  const b = Math.round(beat(t) * 2) / 2, bar = Math.floor(b / 4), off = Math.abs(beat(t) - b) * features.period * 1000;
  return `${bar}:${(b - bar * 4 + 1).toFixed(1).replace('.0', '')}${off > 2 ? ` (+${off.toFixed(0)}ms)` : ''}`;
};
const cell = (s) => String(s).replace(/\|/g, '/');       // keep markdown tables intact
const enterText = (e) => {
  if (!e || (e.type === 'cut' && !e.flash)) return 'cut';
  const bits = [e.type];
  if (e.dur) bits.push(`${+(e.dur / features.period).toFixed(2)} 拍${e.align && e.align !== 'end' ? ' ' + e.align : ''}`);
  if (e.flash) bits.push(`flash ${e.flash}`);
  return bits.join(', ');
};

/**
 * Section summary: [id prefixes, title] (every section is the v4 build: docs/v4/PROGRESS.md).
 * Update the title here when a section is rebuilt.
 */
const SECTIONS = [
  [['preroll'], '0 片頭:閃光警告頁(歌曲開始之前)'],
  [['boot'], '1 啟動'], [['title', 'chat'], '2 標題與第一個問題'], [['v1'], '3 主歌一:用數學回答'], [['pre1'], '4 導歌一:設定被切換'],
  [['c1'], '5 副歌一:對話與四張版畫'], [['v2'], '6 主歌二:三個名詞三張版畫,一張校樣'], [['pre2'], '7 導歌二:設定改的是她本人'], [['c2', 'left', 'alone'], '8 副歌二到空線程:她站在視窗旁,然後第一次睜眼'],
  [['err', 'crash'], '9 越界、第一個錯誤、擴散'], [['exec'], '10 EXECUTION:一台機器,十二圈'], [['count', 'last'], '11 數數與最後一聲'], [['cx'], '12 最後副歌:四張版畫原位重印,但壞了'],
  [['out'], '13 LOVE 四句:課、測驗、公式、證明'], [['down'], '14 結尾:一則未讀的圖片訊息,逆向開機'], [['todo'], '(尚未分鏡)'],
];
const secOf = (id) => SECTIONS.findIndex(([p]) => p.some((x) => id === x || id.startsWith(x + '-')));
const end = (s) => Math.min(s.until, features.duration);
const secRows = SECTIONS.map(([, title], k) => {
  const ss = shots.filter((s) => secOf(s.id) === k);
  if (!ss.length) return null;
  const states = [...new Set(ss.map((s) => s.state))].join(' / ');
  return `| ${tc(ss[0].at)}-${tc(end(ss[ss.length - 1]))} | ${title} | ${ss.length} | ${((end(ss[ss.length - 1]) - ss[0].at) / ss.length).toFixed(1)} s | ${cell(states)} |`;
}).filter(Boolean);

const rows = shots.map((s, i) => {
  const next = shots[i + 1];
  const lines = s.lines ? (s.lines[0] === s.lines[1] ? `${s.lines[0] + 1}` : `${s.lines[0] + 1}-${s.lines[1] + 1}`) : '-';
  return `| ${tc(s.at)}-${tc(end(s))} | ${pos(s.at)} | \`${s.id}\` | ${lines} | ${cell(s.moment || '**(未填)**')} | ${cell(s.layout)} | ${cell(s.state)} | ${enterText(s.enter)} | ${next ? enterText(next.enter) : '黑屏'} |`;
});

// checks
const covered = new Set();
for (const s of shots) if (s.lines) for (let i = s.lines[0]; i <= s.lines[1]; i++) covered.add(i);
const missing = lyrics.lines.map((_, i) => i).filter((i) => !covered.has(i));
// (the warning page before the song is not on the beat grid: there is no beat yet)
const offGrid = shots.filter((s) => Math.abs(beat(s.at) * 2 - Math.round(beat(s.at) * 2)) * features.period * 500 > 2 && s.at > 0.3);
const noMoment = shots.filter((s) => !s.moment || /not storyboarded/.test(s.moment));
const fallback = shots.filter((s) => s.id.startsWith('todo-'));
const lens = shots.map((s) => end(s) - s.at);
const RANGE = flashRangeText(cfg), mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const songRange = `${mmss(cfg.safety.flashRange[0])}–${mmss(cfg.safety.flashRange[1])}`;

const md = `# 分鏡表 / Storyboard(第四版)

由 \`node tools/storyboard.mjs\` 從程式中的鏡頭清單自動生成(共 ${shots.length} 個鏡頭,平均 ${(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(2)} 秒)。
提意見時直接引用「鏡頭 id」;每個 id 對應 \`src/scenes/\` 裡的一個鏡頭定義。敘事與顏色規則見 \`docs/v4/PLAN.md\`,製作進度見 \`docs/v4/PROGRESS.md\`。

整支影片是一場對話。「對話裡的時刻」欄回答每個鏡頭「這是這場對話的哪個時刻」(欄位內容直接取自程式,為英文)。
畫面有三種:介面(使用者看到的對話)、版畫(AI 心裡的意思與感受)、程式碼(只在 EXECUTION 段)。
顏色狀態:off 灰階(AI 未啟動/對方離線)· on 橙(對話中)· warm 更暖更亮 · error 紅(錯誤)· ash 灰帶一點橙 · dead 熄滅。

**時間一律為歌曲時間**(音頻開始 = 0)。成片在歌曲之前有 ${PRE} 秒無聲的閃光警告頁(表中以負的時間列出),所以成片時間 = 歌曲時間 + ${PRE} 秒。

**含閃爍畫面**:成片時間 ${RANGE}(歌曲時間 ${songRange})為高對比快切與強光。量測結果見 README「閃光安全」。

## 段落總表

| 時間 | 段落 | 鏡頭數 | 平均鏡頭長 | 顏色狀態 |
| --- | --- | --- | --- | --- |
${secRows.join('\n')}

## 逐鏡頭

節拍:${features.bpm} BPM,第 0 拍在 ${features.t0} s。「小節:拍」為剪輯點在節拍網格上的位置(小節從 0 起算,拍從 1 起算,x.5 為反拍)。
歌詞行號對應 \`data/lyrics.json\`(從 1 起算);此表不含歌詞文字。轉場名稱見 \`src/engine/transitions.js\`,時長以拍計;
\`start\` / \`center\` 表示轉場從剪輯點開始 / 跨在剪輯點上,未標示則在剪輯點結束。

| 時間 | 小節:拍 | 鏡頭 id | 歌詞行 | 對話裡的時刻 | 構圖 | 顏色狀態 | 進入轉場 | 離開轉場 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## 檢查

- 歌詞覆蓋:${missing.length ? `**缺少** 第 ${missing.map((i) => i + 1).join(', ')} 行` : `全部 ${lyrics.lines.length} 行都有對應鏡頭`}
- 剪輯點對拍:${offGrid.length ? `**不在半拍網格上**:${offGrid.map((s) => s.id).join(', ')}` : '所有剪輯點都落在拍 / 半拍 / 小節線上'}
- 對話時刻:${noMoment.length ? `**未說明**:${noMoment.map((s) => s.id).join(', ')}` : '每個鏡頭都說明了它是對話裡的哪個時刻'}
- 後備鏡頭:${fallback.length ? `**仍有後備鏡頭**(該段尚未製作):${fallback.map((s) => s.id).join(', ')}` : '沒有後備鏡頭'}
`;
fs.writeFileSync(path.join(ROOT, 'STORYBOARD.md'), md, 'utf8');

// the viewer-facing range in README.md: stamped from config, never typed
const readme = path.join(ROOT, 'README.md'), rd = fs.readFileSync(readme, 'utf8');
const stamped = rd.replace(/(<!-- flash-range -->)[\s\S]*?(<!-- \/flash-range -->)/g, `$1${RANGE}$2`);
if (stamped !== rd) fs.writeFileSync(readme, stamped, 'utf8');

console.log(`STORYBOARD.md: ${shots.length} shots; missing lines: ${missing.length ? missing.map((i) => i + 1).join(',') : 'none'}; off-grid: ${offGrid.length ? offGrid.map((s) => `${s.id}@${s.at.toFixed(3)}`).join(', ') : 'none'}; no moment: ${noMoment.length ? noMoment.map((s) => s.id).join(', ') : 'none'}; fallback shots: ${fallback.length ? fallback.map((s) => s.id).join(', ') : 'none'}; flash range (film time): ${RANGE}`);
