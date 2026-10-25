T02 已完成。

- 生成 44.1 kHz 双声道人声轨：[vocals.wav](<assets/audio/vocals.wav>)
- 写入读音分段：[lyrics_kana.json](<data/lyrics_kana.json>)
- 为 26 行歌词写入 `chars`、`morae`、`vocalEnd`：[lyrics_film.json](<data/lyrics_film.json>)
- 新增可复跑的对齐器：[align_lyrics.py](<tools/align_lyrics.py>)
- 产出 26 张对齐图、试听 click 轨和报告：[out/align](<out/align>)

验证通过：26 行、310 个显示字符、349 个 mora；`clicks.wav` 为 44.1 kHz 双声道。报告标记了第 14、22 行的起音偏差，其中第 22 行检测到实际人声比 LRC 锚点晚约 3.22 秒，详见 [report.md](<out/align/report.md>)。