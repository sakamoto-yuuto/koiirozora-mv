# T12 逐字对齐：强制对齐（CTC / 声学模型）路线 + 手工参考标注（codex）

先读 `docs/tasks/ALIGN_CONTRACT.md`（输入、输出格式、评测、规则），以及 `<工作目录>/MV references\音画对齐实践指南.md`（已有的调研，不要重复它的结论，要在它之上做实验）。

## 1. 先做一份手工核对的参考标注（其他方法的"标准答案"）
对 **L0「〔L1〕」、L5「〔L6〕」、L10「〔L11〕」、L25「〔L26〕」** 四行，做 `out/align_lab/reference.json`（同输出格式，只含这四行）：
- 在人声分离轨上画高分辨率图（频谱 0–4 kHz、音高曲线、能量包络、谱通量），逐个 mora 判断它开始的那一刻（辅音起点或母音起点 / 音高跳变处）。不确定的写 `"conf": 0.3` 并说明原因。
- 把每行的判断过程（看了哪些证据）写进结果文档。这份参考会被我抽查，必须认真。

## 2. 实验以下路线（每条都要真的在这首歌上跑出结果）
- **torchaudio MMS_FA**（多语种 CTC 强制对齐；日文假名需转罗马字，uroman 或自己的假名→罗马字表）；
- **日语 wav2vec2 / HuBERT CTC 模型**（例如 HuggingFace 上的日语 xlsr / reazonspeech 系；用 `ctc-forced-aligner` 或 torchaudio `forced_align`），注意日语模型的输出单位（假名或字符）怎么映射到 mora；
- **NeMo Forced Aligner** 或 **Montreal Forced Aligner（日语声学模型）**，至少一个；
- 每条路线都分别在**人声分离轨**和**原曲**上试，比较；
- **后处理**：在每个 mora 时刻 ±80 ms 内吸附到人声起点（谱通量 / 音高跳变），看是否提升；行级时间（LRC 的 start）作为约束是否有帮助。
- 自己发现的其他成熟方案也可以加。

## 3. 交付
- 每个方法：`out/align_lab/<method>.json` + `.eval.json`（`tools/align_eval.py`，带 `--ref out/align_lab/reference.json`）+ `_clicks.wav` + 三行叠加频谱 png；脚本在 `tools/align_lab/<method>/`，一条命令能重跑。
- 结果文档 `docs/tasks/T12.result.md`：每条路线做了什么、遇到什么坑、数字对比表（对参考的中位误差 / 50 ms / 100 ms 命中率，对人声起点的代理指标，L25 单独列）、推荐方案和推荐命令、仍然不可靠的地方。**没有跑通的路线照实写，不要编数字。**
