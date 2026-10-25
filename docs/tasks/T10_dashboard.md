# T10 渲染进度看板升级（工具任务，在 T09 完成后做）

现状：`tools/dashboard.html` 每秒读 `out/progress.json`（`tools/export_parallel.mjs` 写），显示总百分比、帧数、速度、已用时间和每个分块的进度条。通过预览服务器打开：`node export/server.mjs` → `http://localhost:5173/tools/dashboard.html`。

先读 `docs/tasks/T09.result.md`，了解 T09 对导出流水线做了哪些改动，在它的基础上继续改。

## 允许修改的文件
`tools/dashboard.html`、`tools/export_parallel.mjs`、`export/export.mjs`（只加进度/缩略图输出，不改帧内容和编码参数）、`export/server.mjs`（只加静态路由，如需要）。不动 `src/**`、`config.json`、`assets/**`。

## 要加的东西
1. **每一路（worker）一行**：所负责的歌曲时间段、已完成帧数 / 总帧数、当前 fps（最近 10 秒的滑动平均）、预计剩余时间、状态（启动中 / 渲染中 / 收尾 / 完成 / 失败，失败时显示最后几行错误）。
2. **整体**：总百分比、总 fps、预计完成的钟点时间、已用时间；实际使用的 ffmpeg 路径和编码器（NVENC / libx264），回退时用醒目颜色标出。
3. **实时缩略图**：每一路每 3–5 秒导出一张当前帧的小图（宽 320，jpg），看板上每一行旁边显示，鼠标悬停放大。实现方式自选（例如浏览器端把当前帧画进一个小 canvas 再 `toDataURL`，经 WebSocket 或 HTTP 交给 Node 写到 `out/progress/<worker>.jpg`；或让 ffmpeg 多一路输出 `-update 1`）。不能拖慢导出超过 3%：给出开 / 关两种情况下的 fps 对比。
4. **全片时间轴**：一条 0–395.4 秒的横轴，按分段（`src/scenes/cues.js` 的 SECTION）标出段落名，已渲染的部分填色，正在渲染的位置用小三角标出。
5. 导出结束后看板显示输出文件路径、总耗时和平均 fps；`progress.json` 保留最后状态。
6. 看板没有导出在跑时，显示"空闲"和上一次导出的摘要，而不是报错。

## 验收
- 用 `tools/export_parallel.mjs` 实际导出 300–330 秒、1280×720、30 fps、3 路，录下看板在开始、中途、结束三个时刻的截图（可以用 Playwright），存到 `out/_t10/`。
- 结果写到 `docs/tasks/T10.result.md`：改了什么、截图路径、缩略图开销对比。不提交 git。

## 已知坑
同 T09：只按 PID 杀自己启动的进程；`out/` 下面才能被内置 ffmpeg 写；codex 沙箱里生成的文件只能删不能覆盖写。
