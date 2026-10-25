已完成音效合成与混音。

- 新增 [make_sfx.py](tools\make_sfx.py)，覆盖任务规定的 16 类音效、相对 RMS 定标、声像与软限幅。
- 生成 [sfx_stem.wav](assets\audio\sfx_stem.wav)（44.1 kHz、双声道、32-bit float）与 [mix.wav](assets\audio\mix.wav)（44.1 kHz、双声道、16-bit PCM）。
- [config.json](config.json) 的 `paths.audio` 已指向 `assets/audio/mix.wav`。
- 未修改 `src/` 或 `data/`；原始 `track.mp3` 保持不变。

报告摘要：

| 项目 | 结果 |
|---|---:|
| 已合成事件 | 70 |
| 相对响度检查 | 70 / 70 PASS |
| Stem 峰值 | 0.304872 |
| 混音限幅前峰值 | 1.036043 |
| 最终混音峰值 | 0.998901 |
| 音频时长 | 395.413 秒 |

已运行脚本编译检查及音频格式/采样长度核验，均通过。