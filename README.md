# 恋色空 — 非官方同人歌词 MV（制作全过程开源）

森川由綺（CV 平野綾）「恋色空」，TV 动画《WHITE ALBUM》（2009）插入歌。作詞 Bee'，作曲・編曲 藤間仁。

- **成片**：[B 站：【由Opus5.5生成的 恋色空 MV】](https://www.bilibili.com/video/BV12rHP6jEty/)
- **做法**：全片 395.41 秒，没有一帧是手工剪辑的。一个确定性的 Canvas2D + WebGL 引擎按 `renderFrame(t)` 逐帧画出画面，镜头切在节拍网格上，字幕逐字跟着人工打点的时刻出现。人物、路人、背景都由 codex 生成，统一是三墨版画风格；代码只负责光、雪、视差、镜头和字。
- **分工**：人负责制片和审片，Claude 负责导演和实现，codex 负责生图和工程杂活，dsh 负责调研和审稿。

**想学怎么做，先读 [docs/RETROSPECTIVE.md](docs/RETROSPECTIVE.md)**：遇到的困难、双方各自提出的方案、试过但放弃的路，以及一套可以照着复现的流程。

## 目录

| 路径 | 内容 |
|---|---|
| `docs/` | 复盘、剧本与分镜（`STORYBOARD_v2.md`，顶部是 v2.1 / v2.2 修订）、导演方案 `PLAN.md`、做一段的流程 `PROCESS.md`、视觉验收 `VISUAL.md`、交接 `HANDOFF.md`、外包任务书和结果 `tasks/` |
| `research/` | 作品背景、1986 年电话考据、参考作品研究 |
| `src/engine/` | 引擎：渲染循环、调色盘、墨标签图上色（`plates.js`）、三墨分版（`art.js`）、WebGL 后期 |
| `src/scenes/` | 12 段镜头（`01_intro.js` … `12_outro.js`）和合成工具（`stage.js`、`props.js`、`kit.js`、`feet.js`） |
| `art_src/v2/` | 生成美术的源图、提示词（`make_jobs.py`）、引导草图（`guides/`）、逐张审图记录（`REVIEW.md`）、入库脚本（`ingest.py`） |
| `assets/art`、`assets/plates` | 入库后的三墨人物 / 元素，多墨背景 / 物件 |
| `assets/ref_official/` | 生成时用作参考的官方设定图（见各目录的 `SOURCES.md`） |
| `tools/` | 增量渲染、手工打点、缩图审片、节拍表、美术工具、音效合成、对齐实验（`align_lab/`） |
| `export/` | 无头浏览器导出 |
| `blender/` | Blender 预演试验（最终没有用于出图） |

## 没有放进来的东西

- **歌曲音频**（`assets/audio/track.mp3`、人声分轨 `vocals.wav`）：有版权，需要自备。
- **歌词原文**：有版权。`data/lyrics_film.json` 是占位文件，**保留了全部 349 个假名的人工打点时刻**，但每个字都换成了 〇；文档里引用的整句歌词换成了行号，例如 〔L26〕。把真正的 `data/lyrics_film.json` 放回原处，就能带歌词渲染。

## 复现

需要 Node 20+、Chrome 或 Edge（导出用无头浏览器）、Python 3.11+。

```bash
npm install
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS / Linux 用 .venv/bin/pip
```

放好音频（`assets/audio/track.mp3`；如果要用磁带人声，还需要 `vocals.wav`）以后：

```bash
node tools/sfx.mjs && .venv/Scripts/python tools/make_sfx.py      # 合成音效，混出 assets/audio/mix.wav
npm run preview                                                   # 浏览器里实时预览
sh tools/sheet.sh check 10,75,200,330 4                           # 抽几帧做缩图 -> out/check.jpg
node tools/render_film.mjs --start 0 --end 395.41 --jobs 3 --out out/film_720p.mp4   # 增量渲染全片
```

- 歌词时刻怎么打：`tools/tap_prep.py` 生成逐假名列表 → 在 `npm run preview` 打开的页面里访问 `/tools/tap.html` → 空格播放 / 暂停，J 记一个假名，退格撤销 → `tools/refine_taps.py` 写回 `data/lyrics_film.json`。
- 生图流程（需要 codex CLI）：见 `art_src/v2/make_jobs.py`、`art_src/v2/run.sh`，以及复盘的 5.4 节。

## 许可与声明

- 代码以 MIT 许可发布，见 [LICENSE](LICENSE)。引擎的一部分来自 [world-execute-me-lyric-mv](https://github.com/Nyankomintsu/world-execute-me-lyric-mv)（MIT），原声明见 `docs/THIRD_PARTY_LICENSE_world-execute-me.txt`；该项目以 CC BY-NC-SA 发布的剪影素材**没有**使用。
- 本作是非官方同人作品，仅供学习交流，不用于任何商业用途。《WHITE ALBUM》的角色和设定版权归原权利人所有；`assets/ref_official/` 里的设定图归原权利人所有，只作参考用途收录。生成美术依据这些设定创作，同样只用于非商业的同人用途。权利人如有异议，请开 issue，我会尽快删除。
