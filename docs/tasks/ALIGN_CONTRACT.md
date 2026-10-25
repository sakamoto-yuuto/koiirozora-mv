# 逐字（逐拍）歌词对齐：共用约定（T12 codex 与 R02 dsh 都遵守）

目标：给定**音频 + 已知歌词（日文 + 假名读音）**，自动标出**每个假名（mora）被唱出的时刻**，误差尽量 ≤ 1 帧（33 ms），并且方法成熟、可复现、能一条命令重跑。不限于"AI MV"领域：语音 / 歌声强制对齐、卡拉 OK 自动打轴、歌声合成数据集标注（UTAU / DiffSinger / NNSVS 社区）、音乐信息检索（lyrics-to-audio alignment）都算。

## 输入（项目根目录 `<项目根目录>`）
- 原曲：`assets/audio/track.mp3`（森川由綺「恋色空」，约 395 秒；日语女声，伴奏较满）
- 人声分离：`assets/audio/vocals.wav`（Demucs 分离出的人声，44.1 kHz）。可以自己重新分离（htdemucs_ft、MDX、UVR 模型等）做对比。
- 歌词：`data/lyrics_film.json` → `lines[i].text / jp`（日文原文，26 行）、`lines[i].start / end`（行级时间，来自 LRC，较可靠）；`lines[i].chars / morae`（现有自写对齐器的结果，见 `tools/align_lyrics.py`）。
- 读音：`data/lyrics_kana.json` → `lines[i].segments = [[显示文字, 假名], ...]`；mora 的切法与 `tools/align_lyrics.py` 的 `mora_units()` 一致（小写假名并入前一个，`ー` 单独一拍）。

## 输出格式（每个方法一个文件）
`out/align_lab/<method>.json`：
```json
{"method": "...", "command": "how to rerun", "lines": [
  {"line": 0, "morae": [{"k": "た", "t": 75.627, "conf": 0.8}, ...]},
  ...
]}
```
- 26 行全部给出；每行 mora 的个数和顺序与读音完全一致（对不上就失败，不许凑）。`t` 是歌曲秒（mp3 起点为 0），`conf` 可选。
- 可复现：脚本放在 `tools/align_lab/<method>/`，一条命令重跑；需要的环境用自己的虚拟环境（`tools/align_lab/<method>/.venv`，可用 uv），**不要改动项目的 `.venv`**。模型和缓存放在 `tools/align_lab/_cache/`。

## 评测（同一把尺子）
- `.venv/Scripts/python tools/align_eval.py out/align_lab/<method>.json --out out/align_lab/<method>.eval.json`：与人声起点的距离（中位数、50 / 100 ms 命中率、偏差方向）、落在无声处的比例、逐行结果。这只是**代理指标**：连音（母音到母音）没有明显起点，会低估所有方法。
- 现有方法的基线：`out/align_lab/baseline_current.json`（中位数 52 ms、100 ms 内 69%；最后一句 L25 中位数 360 ms，最差）。
- 有手工核对的参考标注时用 `--ref`（见 T12）。
- 除了数字，还要做**听得见、看得见的验证**：为每个方法生成 `out/align_lab/<method>_clicks.wav`（左声道原曲、右声道在每个 mora 时刻一声短促的 click，可参考 `tools/align_lyrics.py` 的 `write_clicks`），以及 L0、L10、L25 三行的频谱图叠加时刻的 png。

## 规则
- 只写 `tools/align_lab/**`、`out/align_lab/**` 和自己的结果文档；**不许改** `data/**`、`src/**`、`assets/**`、`config.json`、`tools/` 下已有的文件。最终替换由导演（Claude）验收后做。
- 本机：Windows 11，RTX 3050 Laptop 4 GB 显存，32 GB 内存。显存小：大模型用 int8 / 半精度 / 中等尺寸；GPU 任务一次只跑一个。别的进程也在用这台机器：只按 PID 结束你自己启动的进程。
- 不要提交 git。
