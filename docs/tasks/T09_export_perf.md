# T09 导出提速实验（工具 / 性能任务，不碰画面）

依据：`<codex 工作目录>/artifacts\ffmpeg-diagnosis-20261022\REPORT.md`（先读完它）。目标：在**像素完全一致**的前提下，让 `tools/export_parallel.mjs` 的端到端导出 fps 尽量提高，并给出可复现的测量。

## 允许修改的文件（只能动这些）
- `export/export.mjs`、`export/wsframes.mjs`、`export/server.mjs`
- `tools/export_parallel.mjs`
- `src/main.js` 里的 `setupExport()`（预览部分不要动）
- `src/engine/post.js`：只限纹理上传和 `readPixels` 的实现，着色器与合成结果不能变
- 新建 `tools/bench_export.mjs`（测速脚本）以及 `out/_t09/` 下的任何文件

**不许动**：`src/scenes/**`、`src/components/**`、`src/engine/art.js`、`src/engine/plates.js`、`config.json` 的调色盘和 art/plates 列表、`assets/**`。另一个人正在同时改场景代码，画面内容会变：测速一律用**同一次运行里**的新旧对照，不要和以前的日志比。

## 要做的事（按报告的优先级）
1. **FFmpeg 选择**：`export/export.mjs` 默认用项目内置 `node_modules/ffmpeg-static/ffmpeg.exe`（系统 PATH 里的 9.0.2 与驱动不兼容 NVENC）。可用 `--ffmpeg <path>` 或环境变量覆盖。日志里打印实际使用的程序路径、版本、编码器；NVENC 探测失败时打印探测的 stderr，回退 libx264 要显眼地写出来。
2. **并行封装器**：`tools/export_parallel.mjs` 不再强制 `--codec libx264`，默认尊重 `config.json` 的 `auto`（即实际能用的 NVENC）；`--codec` 仍可显式指定。默认 `--jobs` 改成 4。
3. **出帧流水线**（报告 §4，重点）：现在每帧串行 `renderFrame → 同步 readPixels → 等 WebSocket ACK`。至少尝试：
   - 不等上一帧的 ACK 就开始渲染下一帧（有界队列，比如最多 2–3 帧在途），让渲染和传输/编码重叠；
   - WebGL2 PBO + `fenceSync` 异步读回（双缓冲），避免每帧 `gl.readPixels` 同步阻塞；
   - 减少重复上传：没有 B 场景时不要再把 A 上传一次当 B；
   - 其余你认为划算、且不改变像素的优化。
   每一项都要能用参数或开关关掉（方便对照）。
4. **并发**：在 2 / 3 / 4 路上测，给出推荐值；不要把 8 路当默认。

## 验收（必须全部做到，写进结果）
- **像素一致**：对时间点 5.0、60.0、126.0、240.5、330.0 秒，分别用旧路径和新路径导出 1280×720 的原始帧，逐字节比较，全部一致才算通过。另外用 `--sheet` 渲一张 5 帧缩图表，新旧都存到 `out/_t09/`。
- **测速**：写 `tools/bench_export.mjs`，在 **240–244 秒**（重镜头）和 **320–326 秒**两段、1280×720、30 fps 上，对「旧路径 x264 / 旧路径 NVENC / 新路径 NVENC」× 「1、2、4 路」测端到端 fps（含启动）和帧循环 fps，每个组合跑 2 遍取平均，组之间串行执行。
- 结果写到 `docs/tasks/T09.result.md`：改了什么、每个开关、测速表、像素比对结果、推荐命令行、没做成的项目及原因。
- 不提交 git。

## 已知坑
- 一定加 `< /dev/null`（由调用方处理）。
- 本机用 PowerShell 按命令行关键词杀进程会连带杀掉当前 shell：只按 PID 杀你自己启动的进程。
- `out/` 目录有 Low Integrity 标签；内置 ffmpeg 只能写到 `out/` 下面。
- codex 沙箱里生成的文件只能删、不能覆盖写：要更新的文件先删再写。
