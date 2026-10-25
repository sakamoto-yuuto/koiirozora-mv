# T09b 导出瓶颈：浏览器 → Node 的帧传输（工具 / 性能任务，不碰画面内容）

先读 `docs/tasks/T09.result.md`（你上一轮的结果）。新测量（2026-10-23，1280×720，单路，内置 ffmpeg，NVENC）：
- 每帧 `render` 1–5 ms，`read` 13–86 ms，`send` 115–240 ms，帧循环 9–22 fps。
- 单独测：Node 往 ffmpeg 管道写原始帧 1085 fps（null 输出）；真实网点画面的 NVENC p7 编码 82 fps、p4 169 fps。所以编码和管道都不是瓶颈。
- 假设：瓶颈是 headless Chrome 的 WebSocket 发送 3.7 MB/帧（以及 Node 端 `ws` 的解掩码，是否装了 bufferutil）。

## 要做
1. **先验证假设**：写一个最小测试页（`out/_t09b/` 下），在同样的 Chrome / Playwright 设置里循环发送 3.7 MB 的 ArrayBuffer 到 `export/server.mjs` 同款 WebSocket，测 MB/s；对比 1.4 MB（YUV420 大小）。检查 Node 端 `ws` 是否在用 bufferutil，没有就测装上后的差别。
2. **如果传输确实是瓶颈**，实现可开关的 `--yuv 1`：在 `post.js` 最后一步之后，用一个着色器把成片转成 BT.709 limited-range 的 **YUV420 平面**（Y 为 W×H，U、V 各为 W/2×H/2，chroma 取 2×2 平均，左上 siting 与 ffmpeg `scale=out_color_matrix=bt709:out_range=limited,format=yuv420p` 一致），渲染进单通道 R8 帧缓冲（宽 W、高 1.5H）后读回，ffmpeg 输入改成 `-pix_fmt yuv420p`，去掉 scale 滤镜。`--sheet` 缩图表和 PNG 路径保持 RGBA 不变。
3. 也可以尝试：Node 端装 `bufferutil`；`perMessageDeflate` 关掉；必要时把一帧拆成几条消息。
4. 验证：同一次运行里，对 5.0、20.5、44.0、60.0、126.0 秒，比较 `--yuv 0` 与 `--yuv 1` 输出 mp4 解码后的画面：PSNR 必须 ≥ 50 dB（Y 平面），并把两版各抽一帧并排存成 png 让人看。测速：0–14 秒和 33–44 秒两段，单路和 4 路，`--yuv 0/1` 各两遍，端到端 fps 和帧循环 fps。
5. 推荐值：并发路数、`--inflight`。

## 允许修改
`export/export.mjs`、`export/wsframes.mjs`、`export/server.mjs`、`tools/export_parallel.mjs`、`src/main.js` 的 `setupExport()`、`src/engine/post.js`（只加输出转换和读回，不改现有着色器的结果）、`package.json`（加 bufferutil）、`out/_t09b/**`。**不许动** `src/scenes/**`、`src/components/**`、`src/engine/art.js`、`src/engine/plates.js`、`config.json`、`assets/**`。另有人同时在改场景代码。

结果写到 `docs/tasks/T09b.result.md`：验证数据、改动、开关、PSNR、测速表、推荐命令。不提交 git。只按 PID 杀你自己启动的进程。codex 沙箱里生成的文件只能删不能覆盖写。
