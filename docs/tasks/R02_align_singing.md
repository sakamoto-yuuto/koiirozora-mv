# R02 逐字对齐：广泛调研 + 歌声专用 / Whisper 系路线的实验（dsh）

先读 `docs/tasks/ALIGN_CONTRACT.md`（输入、输出格式、评测、规则），以及 `<工作目录>/MV references\音画对齐实践指南.md`、`<工作目录>/MV references\代码MV可学习仓库合集.md`（已有的调研成果）。不要只重复这些文件：要**多发散**，找到**真正成熟、可复现**的技术方案，然后**自己做实验验证**。另一个代理（codex，T12）在做 CTC 强制对齐（MMS / wav2vec2 / NeMo / MFA）和手工参考标注，你不要重复那些。

## 1. 调研（用网络搜索，给出处）
重点找"给定歌词 + 歌曲音频，自动标出每个音节 / 每个字被唱出的时刻"的成熟做法，尤其是：
- **歌声合成数据集的标注工具**（日语歌声数据最多的社区）：DiffSinger 生态的 SOFA（Singing-Oriented Forced Aligner）、HubertFA、MakeDiffSinger 的标注流程、NNSVS / ENUNU 的标注方式、UTAU 的自动 oto 工具等；
- **卡拉 OK / 歌词时间轴自动打轴**：日本的卡拉 OK 歌词（ニコカラ、RhythmicaLyrics 等）怎么自动打轴；网易云 / QQ 音乐 / Apple Music 逐字歌词（YRC / QRC / TTML）的生成方式（有公开的吗）；
- **学术**：lyrics-to-audio alignment（MIREX、DALI 数据集、Jiawen Huang 等的多语种歌词对齐、Spotify / Deezer 的工作），有无开源实现；
- **Whisper 系**：stable-ts 的 `align()`（给定文本对齐）、WhisperX、whisper-timestamped、kotoba-whisper 等日语模型；
- 其他你找到的。
每个候选写清：是否开源、许可、是否支持日语、输出到音节 / 音素级吗、是否能"给定文本"对齐、上手难度、有无人在歌声上报告过精度。

## 2. 实验（至少跑通 2–3 个最有希望的，在这首歌上）
优先：**一个歌声专用对齐器**（例如 SOFA 或 HubertFA 的日语模型）、**stable-ts 的给定文本对齐**、以及你调研后认为最有希望的第三个。按共用约定输出 `out/align_lab/<method>.json`，跑 `tools/align_eval.py` 打分（`out/align_lab/reference.json` 由 codex 生成，出现后加 `--ref` 再打一次分），生成 `_clicks.wav` 和 L0 / L10 / L25 的叠加频谱 png。

## 3. 交付
`docs/tasks/R02.result.md`：调研表（带链接）、每个实验做了什么、数字对比表（与基线 `out/align_lab/baseline_current.json` 并列）、推荐方案、仍不可靠的地方。**没跑通的照实写，不要编数字。**
