# AI 音乐 MV 技术栈选型报告：已有图片 + 代码动画（Windows / Intel Iris Xe / 2026-10）

> **项目约束**：Windows 11、Intel Iris Xe（无 CUDA）、Node 24、Python 3.12、FFmpeg、HyperFrames 0.8.180、Remotion 可用；成片 1920×1080、时长 395.413 秒（6:35.41）；需要 2.5D 摄影机、视差、动态日文排印、纸/墨转场、卡点剪辑和大量静帧插画。
> **调研快照**：2026-10-22（Asia/Taipei）。GitHub 星数、最近提交和第三方价格会变化；表中最近活动以公开仓库页/commits Atom 为准。
> **调研方式**：只做公开网页与仓库调研，**未安装 PyTorch/CUDA、未下载大于 1GB 的模型、未修改任何视频资产或项目代码**；临时缓存在 `tools/optional/research_cache/`。
> **引用说明**：第 11 节按编号列出全部来源；正文中的 [n] 即对应条目。
> **需求更新（2026-10-22）**：视频生成与图片生成都不在本报告的技术栈范围内；图片由 Lead 的 Codex 流程负责，本报告只处理已经落盘的 PNG。第 2 节视频生成对比只作排除依据，执行方案以第 0、8、9 节为准。
> **一句话结论**：**保留 HyperFrames + GSAP + FFmpeg 主干；不引入任何图像/视频生成模型或 API。** 只补三组轻量能力：librosa 做节拍网格、Real-ESRGAN/waifu2x ncnn 做静帧放大、DepthFlow + Depth Anything-Small 做少量 hero 镜头的 2.5D；人物运动用 2D cutout rig、粒子、遮罩和排印在代码里完成。图片资产由 Lead 的 Codex 流程提供。

---

## 0. 立即可用

### 0.1 现有工程已经解决了什么

当前 `index.html` 的主合成已经是 **28 个视觉场景 + 3 个全局 overlay**，平均场景约 **14.1 秒**，总时长 `395.413` 秒。`research/lyrics_and_music.md` 已有 26 条日文显示行的 LRC 行级时间码，且大量场景起点直接对齐这些行（如 01:15.83、01:28.43、02:02.82、03:07.85、04:54.44、05:20.44）。这意味着：

1. **不要重建歌词时间轴**。现有 LRC 行级时间码已经够做字幕入场和场景切点；再装 Whisper/WhisperX 是重复劳动。
2. **不要把 HyperFrames 换成 Remotion/Motion Canvas**。现有 HTML/GSAP 已经能表达纸张、错版、墨晕、字符级排印和 1920×1080 合成，换栈只会增加风险。
3. **缺的不是生成更多图，而是让已有图有层次地动**。首先做 2.5D 和 2D 分层，而不是追求全片 AI 视频。

### 0.2 三组现在就能排期的能力

| 优先级 | 能力组 | 采用的具体工具 | 解决的问题 | 首次验收标准 |
|---|---|---|---|---|
| P0 | 节拍网格 | `librosa`（可选 `beat_this` small） | 从 76 BPM 的估算升级为逐拍/小节网格，给新切点和字形落点提供时间基准 | 6:35 音频分析小于 2 分钟；网格与手打拍子误差中位数小于 40 ms |
| P0 | 静帧 finishing | `realesrgan-ncnn-vulkan`（可选 `waifu2x-ncnn-vulkan`） | 在进入 2.5D/合成前把 720p/900p 插画放大到 1080p 或 1440p，减少最终模糊 | 单张 2× 放大小于 30 秒；边缘无严重振铃/塑料感 |
| P1 | hero 镜头 2.5D | `DepthFlow 1.0.1` + `Depth Anything V2 Small` | 给 8–12 个宽/中景建立真正的深度视差，而不是静帧缓慢放大 | 5 秒 1080p 试片小于 15 分钟；画面无大面积拉丝/边缘撕裂 |

> **安装前置条件**：DepthFlow 1.0.1 的 `pyproject.toml` 依赖 `torch`、`torchvision`、`transformers`。按任务约束，**安装 CPU 版 PyTorch 前必须先向 Lead 报告体积和用途**；本轮没有安装。Real-ESRGAN/waifu2x 的 ncnn 便携包不需要 PyTorch/CUDA，可以先做；RIFE 本项目不需要。
> **不要安装的东西**：ComfyUI + SDXL + InstantID/IP-Adapter 的本地身份栈；Wan2.2/FramePack/SVD/MusicVision 的本地视频生成；3D Ken Burns（非商业许可）。详细理由见第 7、8 节。

### 0.3 范围边界：图片与视频生成都不在技术栈内

图片生成/编辑由 Lead 的 Codex 流程负责；本报告不安装、不调用任何图像或视频生成模型/API，也不为生成式服务做预算。技术栈只处理已经落盘的 PNG：

1. 把现有静帧拆成 2D 图层（背景、人物、眼/嘴/发、前景）；
2. 对少量 hero 环境图做 DepthFlow 2.5D；
3. 用 Real-ESRGAN/waifu2x 只放大需要的静帧；
4. 用 librosa 生成节拍网格；
5. 全部运动、纸张/墨转场、动态排印都在 HyperFrames/GSAP/Canvas/SVG 里完成，最后由 FFmpeg 合成。

---

## 1. 硬约束：为什么不能走全片 AI 视频

### 1.1 帧数与存储

| 目标帧率 | 395.413 秒的帧数 | 若展开为 1080p PNG 序列（按 2–4MB/帧） | 含义 |
|---:|---:|---:|---|
| 24 fps | 约 9,490 帧 | 约 19–38 GB | 可接受，但仍应分镜处理 |
| 30 fps | 约 11,862 帧 | 约 24–47 GB | 推荐成片帧率；不要全片走图像序列 |
| 60 fps | 约 23,725 帧 | 约 47–95 GB | 只适合短 hero 镜头；全片无必要 |

### 1.2 本地推理的现实

- Iris Xe 没有 CUDA。绝大多数 2025–2026 的视频扩散仓库把 CUDA/PyTorch 当作默认路径；即使有 CPU offload 或 Vulkan 后端，生成 480p 的几秒片段也往往是分钟级到小时级，且模型权重常是 6–30GB。
- 这支 MV 的视觉风格是 late-2000s TV anime / 水彩纸感 / 有限色 / 手绘线，不是高写实。照片级人脸身份模型的先验反而不匹配（见第 4 节）。真正需要的是同一套角色设定 + 同一套线宽/色板，这更适合 2D cutout rig，而不是 IP-Adapter/InstantID。
- 当前工程已经有 28 个场景，说明时间应该花在逐镜头的 compositing 和节奏，不是重新生成 28 段视频。一个 14 秒场景如果由 AI 生成 3–4 段再拼接，一致性、接缝、重试成本都会爆炸。

### 1.3 一个可执行的镜头预算

| 镜头类型 | 数量建议 | 主要技术 | 备注 |
|---|---:|---|---|
| 宽景/环境 hero | 6–8 | DepthFlow + DAv2-S | 适合有明确前中后景的街景、电话亭、车厢、舞台 |
| 中景人物 | 6–10 | 2D cutout + 轻微 2.5D 背景 | 人物不交给深度模型橡皮拉伸 |
| 特写/表情 | 5–8 | 2D 分层（眼、嘴、发、手） | 这是最稳的角色一致性方案 |
| 纯排印/纸转场 | 10–15 | HyperFrames + GSAP + SVG filter | 现有强项，不增加新工具 |
| 纯代码动效/2D rig | 8–12 | HyperFrames + GSAP + SVG/Canvas | 眼嘴发手分层、粒子、遮罩、错版；这是本项目的主运动手段 |

---

## 2. 视频生成模型：全部不采用（仅保留排除依据）

### 2.1 方案总表

| 方案 | 类型/许可 | 最近活动（快照） | 体积/硬件 | Windows/Intel | 解决的问题 | 结论 |
|---|---|---|---|---|---|---|
| **DepthFlow 1.0.1 + DAv2-S** | 2.5D 视差；代码 AGPL-3.0，Small 模型 Apache-2.0 | 2026-10-22（DepthFlow）；2026-03-24（DAv2） | 仓库约 1.0MB；DAv2-S 约 95MiB；Python 依赖含 torch，安装约 1–2GB（需批准） | Windows 可用；需要本地 OpenGL 驱动实测 | 单张图到带摄像机路径的 2.5D 视频 | **采用（hero 镜头，先做 5 秒试片）** |
| **stable-diffusion.cpp + Wan2.1 VACE 1.3B** | 本地扩散视频；MIT | 2026-10-21 | 权重多 GB（VACE + UMT5 + VAE）；CPU/Vulkan/OpenCL/SYCL | Windows 有构建；Iris Xe 可试 Vulkan，但速度未知 | 真正的 image/reference 到 33 帧、480p 级短视频 | **只做一次基准，不作为生产路径** |
| **Bernini-R 1.3B + OpenVINO** | 本地统一图像/视频编辑；Apache-2.0 | 模型 2026-06-09；OpenVINO notebook 实验性 | 下载约 12GB，加载约 6GB；UMT5 文本编码器约 5GB；20 帧 480×832 级 | OpenVINO 支持 CPU/GPU；实验性 | 参考图到视频、图像编辑、视频编辑 | **观察，不采用** |
| **SVD XT + OpenVINO** | 本地 image-to-video；SVD community license（非 OSI） | 2023 模型；OpenVINO notebook 维护中 | 25 帧、576×1024；多 GB 权重和转换空间 | OpenVINO 可跑，但 CPU 时间不可接受 | 图生 2–3 秒短视频 | **不采用** |
| **Wan2.2 TI2V-5B** | 本地视频生成；Apache-2.0 | 2026-09-21 | README 明确：720p、24fps，至少 24GB VRAM（含 offload） | 官方路径是 CUDA/PyTorch；不是 Intel | 高质量 720p 短视频 | **不采用** |
| **Wan2.2 A14B / FramePack** | 本地视频生成；Apache-2.0 | 2026-09-21 / 2025-10-16 | A14B 约 80GB VRAM；FramePack 至少 6GB NVIDIA，下载大于 30GB | FramePack 有 Windows 一键包，但要求 RTX 30/40/50 | 长视频/高运动幅度 | **不采用** |
| **LTX-Video 2B/13B** | 本地视频；代码 Apache-2.0，权重 OpenRAIL-M 类 | 2026-01-05 | 2B/13B；低显存宣传依赖 NVIDIA 优化 | 官方以 CUDA 为主；无 Iris Xe 生产路径 | 快速文/图生视频 | **不采用（本地）** |
| **Runway API（视频）** | 云托管；商业 API | 价格页 2026 当前 | 无本地硬件 | 任意浏览器/HTTP | 图生视频 | **不采用：本项目不做视频生成；仅保留成本对照** |

**表注**：本节所有视频生成模型均不进入执行方案，仅用于说明为何排除。主要来源 [1][5][19][25][26][27][28][29][30][31]。`stable-diffusion.cpp` 的 Wan 文档给出 33 帧、832×480 的 VACE 示例；它证明 Intel 可通过 Vulkan/SYCL 跑在技术上是可能的，但没有证明 6:35 成片所需的速度和稳定性。在 Iris Xe 上，先用一张图生成一个 33 帧片段并计时；如果单段 2 秒超过 5–10 分钟，就直接放弃这条路线。

### 2.2 对本项目的判断

1. **短镜头 2.5D 是图像到视频的性价比最高解**。它能提供摄影机推进、横移、轻微环绕、前景/背景速度差，正好对应视觉研究里的每个镜头至少两层运动 + 一次质感事件。
2. **全片 AI 视频不可取**。不仅因为硬件，更因为 28 个场景的角色、服装、线宽、纸张质感需要严格一致；视频模型每次重采样都会改变这些。
3. **生成式模型/API 全部交给 Codex，不进入本报告**：图片生成/编辑由 Lead 的 Codex 流程负责；本报告只消费 PNG，并把人物转头、呼吸、发丝飘动、纸张翻飞等运动用 2D cutout 分层 + GSAP/Canvas 粒子/遮罩实现。

---

## 3. Depth-based 2.5D / 视差工具对比

### 3.1 对比表

| 工具/方法 | 许可 | 最近活动 | 体积/依赖 | Intel/Windows | 产出与限制 | 结论 |
|---|---|---|---|---|---|---|
| **DepthFlow** | AGPL-3.0 | 2026-10-22 | 仓库约 1.0MB；依赖 Python、OpenGL、torch/transformers（估算 1–2GB） | Windows 有支持页；需本机 OpenGL 实测 | 高质量 ray-marching 视差、循环、批量、FFmpeg 直出；对细线/发丝/铁丝有伪影 | **首选 2.5D 引擎** |
| **Depth Anything V2 Small** | Apache-2.0（仅 Small；Base/Large 为 CC BY-NC-4.0） | 2026-03-24 | 24.8M 参数，约 95MiB；CPU 可跑，OpenVINO 可加速 | Windows/Python/OpenVINO 可用 | 单目深度图；对插画/动画的鲁棒性好；不是视频模型 | **首选深度估计器** |
| **MiDaS small** | MIT（仓库） | 2024-08-23 | 轻量；PyTorch | CPU 可跑 | 老一代深度，边缘和细节弱于 DAv2 | 备选，不优先 |
| **ComfyUI + ComfyUI-DepthAnythingV2 节点** | ComfyUI 等各自许可 | 节点随 DAv2 生态更新 | ComfyUI + torch + 自定义节点 + 模型，轻易 10GB 以上 | Windows 可装，但依赖链长 | 可视化工作流、便于试模型；对单纯深度图是过度工程 | **不要为深度图引入 ComfyUI** |
| **OpenCV remap / FFmpeg displace** | OpenCV Apache-2.0；FFmpeg 依构建（GPL/LGPL） | 稳定 | 无模型；numpy/OpenCV | CPU 原生 | 可做简单的逐像素位移/分层视差；遮挡洞、边缘拉伸需手工遮罩 | **无 PyTorch 时的 fallback** |
| **FFmpeg zoompan / perspective** | FFmpeg 许可 | 稳定 | 无 | CPU 原生 | 只能做平面推拉/透视，不是真深度视差 | 只用于非 hero 镜头 |
| **3D Ken Burns** | **CC BY-NC-SA 4.0** | 2026-06-01 | 仓库 383KB；PyTorch/MiDaS 依赖 | 可跑但老 | 单图 3D Ken Burns；质量不如 DepthFlow，且**禁止商业使用** | **不采用** |

**表注**：主要来源 [1][2][3][5][7][8][9]。

### 3.2 推荐管线（DepthFlow + DAv2-S）

先校准预期：DepthFlow README 的 8K50fps 是 RTX 3060 级数据，Iris Xe 不适用；本项目只看 1080p 试片的实测吞吐，不拿宣传数字推算全片。[1]

1. **选镜头**：只选 8–12 个有明显前/中/后景的图。电话亭、车厢窗、舞台、雪街、走廊比人物大特写 + 碎发更适合深度。
2. **先做深度图**：用 DAv2-S 在 768–1024 长边推理，输出归一化、近处为白的灰度 PNG。保留原图尺寸信息，不要让深度图被二次拉伸。
3. **检查深度方向**：DepthFlow 明确要求 normalized、near-is-white；如果模型输出近处为黑，先反相。错误方向会导致背景冲到镜头前。
4. **DepthFlow 只做背景/环境层**：5 秒、1080p、30fps 试片；摄像机路径用推进 + 轻微横移 + 很小 roll，不要剧烈环绕。SSAA 从 1.0 起步，确认性能再上 1.5/2.0。
5. **人物单独合成**：人物/头发/手不要直接喂给深度模型做整体 3D 拉伸；在 HyperFrames 里作为前景层，以不同速度叠加。这样脸不会被橡皮膜拉坏。
6. **验收**：画面必须有至少两层不同速度的运动 + 一次纸纹/颗粒/错版事件；只有一层缓慢放大 = 不合格，按现有视觉研究的标准直接退回。

### 3.3 许可提醒

DepthFlow 是 **AGPL-3.0**。用它在本机生成 MV 画面通常不改变输出视频的版权；但如果后续把修改后的 DepthFlow 作为服务/产品分发，或把代码嵌入闭源工具，需要单独做法务确认。**把它当 CLI 用，不要把源码 vendor 进闭源项目。**
DAv2 只有 **Small** 是 Apache-2.0；Base/Large/Giant 是 CC BY-NC-4.0，不要为了更好一点误用非商业权重。

---

## 4. 角色一致性 / 动漫脸部身份

### 4.1 结论先行

对本项目，**最可靠的角色一致性不是 IP-Adapter，也不是 InstantID，而是 2D cutout rig + 固定角色圣经**。原因不是工具不好，而是：

- 画风是 late-2000s TV anime、水彩纸感、有限色、细线；InstantID 的人脸先验偏写实，容易把脸拉成现代 AI 写真。
- 全片 28 个场景，身份一致性靠发型轮廓、发夹位置、眼型、虹膜色、服装色板、线宽这些可编码不变量，比每次重新扩散更稳。
- 本地 SDXL + ControlNet 在 Iris Xe 上没有可用吞吐；CPU 出图是分钟级/张，且需要多轮试错。

### 4.2 方法对比

> 说明：图片生成/编辑由 Lead 的 Codex 流程负责；下表只解释为何不在本地接 IP-Adapter/InstantID，不代表本报告要实施图像生成。

| 方法 | 许可/硬件 | 对项目的适配 | 成本/时间 | 结论 |
|---|---|---|---|---|
| **2D cutout rig（推荐）** | 自有 PNG/矢量资产；无模型 | 最高：眼、嘴、发梢、手、围巾可独立动；线宽/色板完全可控 | 1–2 天做 4–6 套基础姿势/表情 | **采用** |
| **Lead 的 Codex 图片流程** | 外部；不在本报告范围 | 负责生成/修图和提供分层资产；本报告只消费落盘 PNG | 由 Lead 控制 | **唯一图片入口** |
| **云端图像编辑 API** | 商业 API；本报告不接入 | 仅作为 Codex 之外的备选，不进入执行方案 | 不在预算内 | **不考虑** |
| **IP-Adapter** | 代码 Apache-2.0；SD1.5/SDXL 基础模型和权重另有许可 | 低–中：更像风格/内容参考，不是精确身份；对细线动画容易加塑料感 | SD1.5/SDXL + PyTorch；CPU 每张数分钟级 | 不本地采用 |
| **InstantID** | 代码 Apache-2.0；**官方 checkpoint 研究用途，InsightFace 人脸模型非商业** | 低：写实人脸先验，和本画风冲突；许可风险高 | SDXL + ControlNet + InsightFace；建议 NVIDIA 级环境 | **不采用** |
| **Reference-only ControlNet** | 取决于 WebUI/扩展和基础模型许可 | 低：需要 A1111/ComfyUI，仍依赖 SD；身份保持有限 | 环境重、模型多 | 不采用 |
| **LoRA（角色）** | 训练脚本多为 Apache/MIT；基础模型许可另算 | 高（若角色贯穿全片），但需要 15–30 张干净图、训练和集成 | 云端 GPU 更现实；本地 CPU 数小时到数天 | 暂不采用；除非 2D rig 仍不够 |
| **FaceFusion / 换脸** | 各有许可；涉及肖像权 | 不推荐：动画脸容易塑料化，且伦理/版权风险高 | — | 不采用 |

**表注**：主要来源 [12][13][19][35][36]。

### 4.3 角色圣经的最小字段

把以下字段写进一个共享 JSON/JS 常量，所有场景从同一处读取，而不是每个镜头重新描述：

```json
{
  "hair": "muted wine-brown, center-right part, airy side-swept fringe, pale-blue barrette on her right",
  "eyes": "warm chestnut, elongated oval, restrained highlight, dark-brown upper lash line",
  "outfit": "cream knit, deep blue-gray trousers, vermilion scarf and small jewelry",
  "line": "fine graphite/ink contour over mottled watercolor paper",
  "palette": ["#F1EDE4", "#AFC9D8", "#163A46", "#B8493E", "#D99A5B"],
  "forbid": ["modern moe", "plastic skin", "oversized eyes", "photoreal portrait", "busy patterns"]
}
```

**脸部动画预算**：全片只做 4–6 个基础表情（平静、微笑、欲哭、惊讶、低头、侧望）；每个表情只动眼睑、瞳孔、眉、嘴、发梢。特写镜头也不要每帧重绘，靠 2D 图层和轻微 GSAP 位移。

### 4.4 与 Codex 图片流程的资产接口（只消费，不生成）

图片生成/编辑已经由 Lead 的 Codex 流程承担，本报告不再选图片模型。为了让代码动画稳定，建议要求 Codex 按下面的资产契约交付：

| 交付物 | 规格 | 用途 |
|---|---|---|
| 角色 base | 2048px 透明 PNG；所有姿势共用同一画布尺寸与 anchor | 2D rig 主体 |
| 眼/嘴/眉 | 独立 PNG 或 sprite sheet；与 base 同 anchor | 4–6 个表情 |
| 发梢/手/围巾 | 可选 2–4 个独立层，边缘干净、无白边 | 微动、风、呼吸 |
| 背景 | 1.5–2× 成片尺寸，full-bleed，无文字/水印 | DepthFlow 或 2D 分层 |
| 深度图（可选） | 16-bit 灰度、近处白、与背景同宽高 | 减少 DAv2 推理时间 |
| 角色圣经 | JSON：发型/发夹/眼型/服装色板/线宽/禁用项 | 所有镜头共用 |

**验收规则**：

- 透明 PNG 用 straight alpha，避免黑边/白边；所有层保持同一画布和 anchor，不要在每个镜头里重新裁切。
- 如果 Codex 不能稳定给分层，至少给角色 base + 眼睛开/闭 + 嘴型 A/B/C 三组，代码里用 `clip-path`/`mask` 切换。
- 深度图可选；没有深度图就用 DAv2-S 从背景估计，人物仍走 2D 层，不做整体 3D 拉伸。
- 不要求 Codex 生成视频；所有运动必须在 HyperFrames 里可重放、可逐帧渲染。

---

## 5. Beat / 音乐同步 / 歌词时间轴

### 5.1 先确认：你已经有的东西

- `research/lyrics_and_music.md` 已有 **26 条显示行**的 LRC 行级时间码，且标注了段落（V1/B1/C1/V2/B2/C2/C3）和剪辑地图。
- `audio_features.npz` 已有 17,026 个时间采样、`flux`（频谱通量）和 `bpm=76.0`。
- `index.html` 的多个场景起点直接等于 LRC 行起点（如 75.83、88.43、101.22、110.95、122.82、294.44、307.65、320.44），说明**歌词行级同步已经接好**。

因此本项目的正确动作是：

1. **保留 LRC 行级时间码，不做 Whisper 重转录。**
2. 用 `librosa` 或现有 `flux` 生成逐拍/小节网格，只服务新增切点、字形落点、镜头内节奏。
3. 如果日文逐字时间真的需要，再考虑 `faster-whisper` small；但这不是当前瓶颈。

### 5.2 工具对比

| 工具 | 许可 | 硬件/体积 | 能解决什么 | 对本项目 | 结论 |
|---|---|---|---|---|---|
| **librosa** | ISC | CPU；依赖 numba/llvmlite 等，约百 MB 级 | onset、beat_track、BPM、RMS、STFT、分段特征 | 最轻的节拍网格工具；可输出 `beats.json` | **采用** |
| **Beat This** | MIT（代码和公开权重） | CPU 可跑，需 PyTorch；small 模型 8.1MB，final 78MB | 更稳的 beat/downbeat 检测，支持 `--gpu=-1` 强制 CPU | 如果 librosa 在 76/152 BPM 上摇摆，再用 small | 备选 |
| **faster-whisper** | MIT | CPU int8；small 模型约 0.5GB；官方基准 13 分钟音频 1m42s、1.48GB 内存 | 词级时间戳、日文转录 | 现有 LRC 已足够；只有做逐字卡拉 OK 才需要 | **暂不采用** |
| **whisper.cpp** | MIT | C++，CPU；small 模型数百 MB | 无 Python 的 Whisper 推理 | Windows 可做，但集成成本高于 faster-whisper | 备选 |
| **WhisperX** | BSD-2 | PyTorch + wav2vec2 对齐模型，安装重 | 词级对齐、说话人分离 | CPU 上性价比低；现有 LRC 更可靠 | **不采用** |
| **madmom** | BSD 类 | 旧 Python/numpy 约束，Python 3.12 兼容性差 | 经典 beat/DBN | 有更新替代品 | **不采用** |
| **aubio** | GPL-3.0 | C/Python；Windows wheel 麻烦 | onset/pitch/beat | GPL + 旧 | **不采用** |
| **aeneas** | AGPL-3.0 | 旧 Python，Windows 依赖麻烦 | 文本-音频强制对齐 | 过时；LRC 已有 | **不采用** |
| **music-mv 的 `analyze_song.py`** | MIT | Python + librosa；轻 | BPM、逐拍、downbeat、分段、能量事件 | 与本项目最接近的参考实现，可直接借鉴算法 | **读代码/按 MIT 借鉴** |
| **BeatSync Engine** | AGPL-3.0 | Windows 便携；CPU 导出；Qwen3-VL 可选 | 节拍网格、能量分段、镜头选择、帧锁定导出 | 设计值得读，但它是现有视频到 AMV，不是静帧到 MV；AGPL 不要直接复制进闭源代码 | **只研究设计** |

---

**表注**：主要来源 [14][15][16][17][18][20][22]。

### 5.3 立即可用的节拍 JSON

建议生成一个独立文件，HyperFrames 只读这个文件，不在时间轴里散落魔法数字：

```json
{
  "bpm": 76.0,
  "beat_interval": 0.7895,
  "bar_interval": 3.1579,
  "beats": [0.43, 1.219, 2.009],
  "downbeats": [0.43, 3.588, 6.746],
  "sections": [
    {"name": "intro", "start": 0.0, "end": 75.83},
    {"name": "V1", "start": 75.83, "end": 101.22},
    {"name": "C1", "start": 122.82, "end": 149.14}
  ]
}
```

**从现有 `audio_features.npz` 拟合相位的思路**（无需装任何库）：

```python
import numpy as np
d = np.load("audio_features.npz")
t, flux, bpm = d["t"], d["flux"], float(d["bpm"])
period = 60.0 / bpm                    # 76 BPM -> 0.7895 s
dt = float(t[1] - t[0])
phases = np.arange(0.0, period, 0.005)
scores = []
for phase in phases:
    grid = np.arange(phase, t[-1], period)
    idx = np.clip(np.rint(grid / dt).astype(int), 0, len(flux) - 1)
    scores.append(flux[idx].sum())
phase = float(phases[int(np.argmax(scores))])   # 本次快照约 0.43 s
```

> 注意：76 BPM 很可能是半速感。**结构和小节用 76 BPM，切点细分可以用 152 BPM（半拍 0.3947 秒）**。上面的 0.43 秒只是 flux 相位起点，不是官方第一拍；必须边听边校准。

### 5.4 量化规则

- 只对新加切点/字形落点做量化：`t_q = phase + round((t - phase)/step) * step`。
- 如果量化位移大于 80ms，**不要硬吸**；保留原时间。歌词行首更要以 LRC 和人声为准，不能为了网格把整句提前。
- 段落密度：前奏/尾奏少切；副歌 1–2 拍一切；深静音（2:54.35–3:07.85）保持长镜；器乐桥段（4:24.16–4:54.44）持续 build，不要突然碎切。
- 现有 LRC 的 26 行时间码不要改；只把场景内的小动作绑到 beats。

### 5.5 动态日文排印

- 用 HyperFrames 现有 GSAP 时间轴；字符拆分推荐 `Intl.Segmenter("ja", {granularity:"grapheme"})`，不要简单 `split("")`，以免把浊点/组合字符拆坏。
- 行首入场绑定 LRC 起始 + 0.15s 淡入；字符 stagger 40–80ms；**不要每个字都卡拍**，否则会变成打字机噪声。
- 竖排用 `writing-mode: vertical-rl` + `text-orientation: upright`；英文小字横排，保持现有 Shippori Mincho / Klee One 的字体组合。
- 纸张/墨转场优先用 Chromium 原生 CSS mask + SVG `feTurbulence`/`feDisplacementMap`，固定 seed，保证逐帧确定性；不要为了纸纹引入视频模型。
- 5:20.44 的标题句应保留到约 5:34，跟着声音尾迹淡出；不要在这一段凭空补歌词。

---

## 6. 视频后期：放大、补帧、编码

### 6.1 工具对比

| 工具 | 许可 | 体积/依赖 | 硬件 | 作用 | 结论 |
|---|---|---|---|---|---|
| **Real-ESRGAN ncnn Vulkan** | BSD-3-Clause（代码）；权重随发布包 | Windows 便携包约 43.4MiB，无需 CUDA/PyTorch | Vulkan；Intel/AMD/NVIDIA，CPU 也可 | 静帧放大、动漫视频小模型 `realesr-animevideov3` | **采用：只放静帧和短 hero 片段** |
| **waifu2x ncnn Vulkan** | MIT | Windows 包约 33.9MiB | Vulkan；CPU 也可 | 动漫线稿/平涂放大，线条干净 | 备选：线稿感强的图优先试 |
| **RIFE ncnn Vulkan** | MIT | Windows 包约 411.6MiB（含模型） | Vulkan；Intel 集显可跑，CPU 也可 | 30→60fps、24→48fps 补帧；含 `rife-anime` | **不采用：本项目没有 AI 视频片段；仅保留给外部 24fps 素材** |
| **FILM** | Apache-2.0 | TensorFlow；仓库约 27MB，模型另计 | CPU/GPU；CPU 很慢 | 帧插值 | 不采用：RIFE ncnn 更轻 |
| **Video2X** | AGPL-3.0 | 仓库约 561MB；封装 Real-ESRGAN/RIFE 等 | Windows/Linux，GPU 可选 | 一站式视频超分/补帧 | 不采用：多一层框架，AGPL |
| **FFmpeg `scale`/`unsharp`/`cas`** | FFmpeg 构建许可 | 已安装 | CPU | 最终缩放、锐化、对比度、颗粒 | **采用：最终编码前统一处理** |
| **FFmpeg `minterpolate`** | FFmpeg 构建许可 | 已安装 | CPU，非常慢 | 无模型补帧 | 仅应急；默认不用 |

**表注**：主要来源 [9][10][11][32][33][34]。

### 6.2 使用规则

1. **放大静帧，不放大全片**。在进入 DepthFlow/HyperFrames 前，把低于 1080p 的关键插画用 Real-ESRGAN 2× 或 1.5× 放大；最终成片保持 1920×1080。
2. **不要对 6:35 全片做图像序列放大**。30fps 的 11,862 帧按 2–4MB/帧就是 24–47GB；60fps 会到 47–95GB，还没算中间文件。需要放大视频时，按 5–10 秒分块处理，处理完立即编码并删除帧。
3. **本项目不做补帧**。HyperFrames 原生就能渲染 30fps；只有引入外部 24fps 素材且运动明显不顺时，才考虑 RIFE。文字/线条/纸张边缘镜头不要补，鬼影风险高。
4. **RIFE 不是万能**：快速横移、纸张边缘、文字和细线容易产生鬼影；先拿 2–3 秒测试，文字/线条镜头不要补。
5. **最终编码用 H.264 8-bit 4:2:0**：`libx264 -preset slow -crf 18 -pix_fmt yuv420p`，兼容性优先；不要用 10-bit/HDR 给自己增加回放风险。

### 6.3 建议命令（先小段试跑）

```powershell
# 静帧 2x 放大（Real-ESRGAN ncnn）
.\realesrgan-ncnn-vulkan.exe -i .\in\still.png -o .\out\still_2x.png -n realesr-animevideov3 -s 2

# 最终编码（示例；不要盲目 -shortest 截掉尾奏）
ffmpeg -y -i .\render.mp4 -i .\audio_mono.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 320k -movflags +faststart .\final.mp4
```

> 命令里的文件名只是示例；Windows 路径、Vulkan 驱动和模型目录要按实际安装位置调整。RIFE/Real-ESRGAN 都依赖 Vulkan 驱动，先在本地控制台运行 `vulkaninfo` 或程序自带 `-l` 列表确认 Intel GPU 被识别。

---

## 7. 完整 AI-MV 仓库：哪些值得研究，哪些是时间黑洞

### 7.1 总表

| 仓库 | 许可 | 最近活动（快照） | 星数 | 安装体积/硬件 | Windows | 它解决什么问题 | 现在是否采用 |
|---|---|---|---:|---|---|---|---|
| [Win-Hao/music-mv](https://github.com/Win-Hao/music-mv) | MIT | 2026-10-20 创建并提交 | 14 | 代码很小；依赖已有 HyperFrames/FFmpeg；可选 Whisper | 基本可用；脚本里的 `python3` 可能要改成 `python` | 用 agent 流程做代码绘制 MV：听歌、角色、分镜、HyperFrames、FFmpeg、contact sheet/节奏检查 | **借鉴脚本和流程，不作为依赖** |
| [tsondo/musicvision](https://github.com/tsondo/musicvision) | Apache-2.0 | 2026-08-16 | 5 | 100GB SSD；双卡最低 20GB VRAM（单卡建议 32GB）；推荐 64GB RAM | Linux/WSL2/Windows CUDA；不是 Intel 路径 | 歌 + 角色图到分镜、视频、放大、粗剪、EDL/FCPXML 的全本地管线 | **只研究架构，不安装** |
| [Merserk/BeatSync-Engine](https://github.com/Merserk/BeatSync-Engine) | AGPL-3.0 | 2026-07-06 | 70 | 便携包 + 可选 Qwen3-VL，数 GB 级 | Windows 原生；CPU H.264 导出，CUDA 可选 | 从已有视频自动做卡点 AMV/GMV：节拍、能量分段、镜头选择、帧锁定时间线 | **读设计，不复制代码** |
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | MIT | 2026-10-22 | 133,949 | 仓库约 528MiB；最低 4GB RAM，GPU 非必需 | Windows 一键包 | 主题到短视频：脚本、素材、TTS、字幕、拼接；不是音乐驱动 | **不采用；只看字幕/任务编排** |
| [akranjha0070-rgb/Songify.AI](https://github.com/akranjha0070-rgb/Songify.AI) | 未见 LICENSE | 2025-10-17 创建 | 1 | 未知；README 是 AI Studio 模板 | Web demo | 声称歌到 MV，但公开内容无法验证完整流水线 | **不纳入候选** |

**表注**：仓库信息来自各行 GitHub 链接及 commits Atom；补充来源 [20][21][22][23][24]。

### 7.2 三个值得读的仓库

#### music-mv（最贴近本项目）

- **它是什么**：一个 agent skill/教程，明确写每帧都是代码画的，不是视频生成；管线是 HyperFrames + FFmpeg；包含 `analyze_song.py`（BPM、逐拍、downbeat、分段、能量事件）、`contact_sheet.py`、`video_rhythm.py`、`finalize_audio.py`。
- **为什么值得看**：它和你现在的技术栈几乎同构，且把歌词时间、角色一致性、分镜、看片 QA 拆成了可复用步骤。README 自述 p5.brush 水彩约 0.3 秒/帧，1 分钟成片约 200 分钟渲染；这个量级比本地视频扩散现实得多。
- **风险**：2026-10-20 才创建，只有 14 星，没有长期生产验证。**按 MIT 借鉴脚本/数据格式，不要把它当稳定依赖。**
- **最适合拿什么**：`analyze_song.py` 的节拍/分段思路、contact sheet 的 QA 方式、把角色不变量写进代码文件的做法。

#### MusicVision（完整 AI MV 的架构样本）

- **它是什么**：Apache-2.0 的五阶段本地 AI MV 管线：歌曲切场 → 图像分镜 → HuMo/LTX-Video 2 视频 → SeedVR2/Real-ESRGAN 放大 → 拼接/EDL/FCPXML。README 明确说五个阶段 code-complete，2026-03-01 做过端到端测试。
- **为什么值得看**：它的场景切分、子片段链式衔接、帧精度音频断言、按镜头重生成、导出 EDL/FCPXML 的设计，都可以在 HyperFrames 里用轻量方式复刻。
- **为什么不能采用**：双卡最低 20GB VRAM / 单卡建议 32GB、推荐 RTX 5090 32GB、100GB SSD；Windows 路径实际是 WSL2/CUDA。对 Iris Xe 是硬性不可行。
- **最适合拿什么**：分镜/审批数据模型、每个镜头作为独立单元重试、最终音频不重编码而是用原始歌轨。

#### BeatSync Engine（卡点编辑器的设计参考）

- **它是什么**：Windows 便携的卡点 AMV/GMV 工具，输入一首歌 + 一个或多个源视频，输出节拍同步剪辑；有节拍网格、能量分段、镜头库、Qwen3-VL 语义标签和帧锁定导出。
- **为什么值得看**：它的 Stage 1–6 拆分（audio → features → sections → selection → semantic → planner）很适合借用为 HyperFrames 的 JSON 数据结构。
- **为什么不能直接用**：它是从已有视频剪，不是从静帧生成；AGPL-3.0，如果你把代码复制进项目并分发，会触发 copyleft。**只读设计，不要复制代码。**

---

## 8. 最终决策

### 8.1 现在采用的三组工具

| 顺位 | 工具组 | 解决的问题 | 安装风险 | 什么时候做 |
|---|---|---|---|---|
| 1 | **librosa** | 逐拍/小节网格、onset、能量特征；输出 `beats.json` 给 HyperFrames | 低；无 PyTorch，约百 MB 级 | 立刻；先跑 30 秒试片 |
| 2 | **realesrgan-ncnn-vulkan** | 静帧放大到 1080p/1440p，减少 2.5D 运动时的模糊 | 低；43.4MiB 便携包，无 CUDA/PyTorch | 立刻；先放 1 张角色图 |
| 3 | **DepthFlow + Depth Anything V2 Small** | 8–12 个 hero 环境镜头的真 2.5D | 中；DepthFlow 依赖 PyTorch，需先报告 Lead 批准 | 第二批；5 秒 1080p 试片通过后再批量 |

**排序理由**：前两个工具不依赖 CUDA/PyTorch，今天就能验证；DepthFlow 价值最高但安装链最重，放在 P1，且**绝不能阻塞主时间线**。如果 DepthFlow 试片不通过，直接用第 9 节的 2D 分层 fallback，不用等它。

### 8.2 明确不要采用的三个东西

| 不采用 | 原因 | 更便宜的替代 |
|---|---|---|
| **本地视频扩散全家桶**（Wan2.2 5B/A14B、FramePack、SVD XT、MusicVision 本地） | 24–80GB VRAM、30–100GB 下载/缓存、CUDA 路径；Iris Xe 不在支持范围；用户也已排除视频生成 | 2.5D DepthFlow + 2D rig；hero 静帧由 Codex 图片流程补 |
| **InstantID / IP-Adapter / SDXL + ComfyUI 本地身份栈** | 无 CUDA 吞吐；SDXL/ControlNet/PyTorch 依赖重；InstantID checkpoint 研究用途、InsightFace 非商业；写实人脸先验不适合本画风 | 2D cutout rig；图片资产由 Codex 流程提供 |
| **3D Ken Burns** | CC BY-NC-SA 4.0，商业 MV 不能用；质量/维护也不如 DepthFlow | DepthFlow 或 OpenCV/FFmpeg 分层视差 |

**另外不要做**：

- 不要把 6:35 全片展开成 PNG 序列做 Real-ESRGAN/RIFE；存储和时间都会失控。
- 不要为了纸纹/墨转场引入 ComfyUI 或视频模型；HyperFrames 的 CSS/SVG filter 已经够。
- 不要把 Songify.AI 这类 README 只有 AI Studio 模板、无许可证、无生产验证的仓库纳入关键路径。
- 不要在没报告 Lead 的情况下安装 PyTorch/CUDA 或下载大于 1GB 的模型。

### 8.3 生成式 API：不接入

**本项目不接图像或视频生成 API。** 图片生成/编辑由 Lead 的 Codex 流程负责，成本与配额不在本报告估算；本报告的技术栈本地工具成本为 **$0**（除磁盘和电费）。不要为了这支 MV 另开 Runway/Replicate/fal.ai 账户，也不要把视频生成放进关键路径。

### 8.4 决策矩阵

| 选项 | 本项目收益 | 时间/硬件风险 | 结论 |
|---|---|---|---|
| HyperFrames + GSAP + FFmpeg 现有主干 | 高 | 低 | **保留** |
| librosa 节拍网格 | 高 | 低 | **采用** |
| Real-ESRGAN/waifu2x ncnn | 中高 | 低 | **采用（静帧）** |
| DepthFlow + DAv2-S | 高 | 中（PyTorch/OpenGL） | **试片后采用** |
| RIFE ncnn | 低（本项目无视频片段） | 中（Vulkan/鬼影） | **不采用** |
| Codex 图片生成/编辑（外部） | 高（资产来源） | 不在本报告范围 | Lead 负责 |
| 本地 Wan/FramePack/SVD/MusicVision | 低（跑不动） | 极高 | **避免** |
| InstantID/IP-Adapter 本地 | 低（风格不匹配/许可） | 高 | **避免** |
| 3D Ken Burns | 低 | 许可高风险 | **避免** |

---

## 9. 如果最后只剩 HyperFrames + FFmpeg：完整 fallback

这个 fallback 不是降级成幻灯片；它用现有 28 个场景和现有 LRC，把每个镜头做成至少两层运动，并保持纸张/排印风格。

### 9.1 结构：保留 28 场景，不要重排全片

- 继续用 `index.html` 的 28 个 scene + 3 个 overlay；只在有把握的镜头里增加图层/深度，不要重写时间轴。
- 每个 scene 先做 2D 版本并渲染出来；2.5D 版本作为可替换层，不通过就回退 2D，不阻塞整片。
- 先在 3 个镜头试点：一个宽景（电话亭/雪街）、一个中景人物、一个纯排印/纸转场；确认风格后再批量。

### 9.2 无深度模型的 2.5D：三层 cutout

把一张图在 GIMP/Photoshop 里拆成 3–5 层：背景、远景道具、人物/中景、前景（雪、窗框、纸边）。不要自动抠所有图；只做 8–12 个 hero 镜头。HyperFrames 里用嵌套 `div` 和 GSAP 给不同层不同速度：

```html
<div class="parallax" style="--camX:0;--camY:0">
  <img class="layer l0" src="bg.png">
  <img class="layer l1" src="mid.png">
  <img class="layer l2" src="char.png">
  <img class="layer l3" src="fg_snow.png">
</div>
```

```css
.parallax { position:absolute; inset:0; overflow:hidden; perspective:1400px; }
.layer { position:absolute; inset:-6%; width:112%; height:112%; object-fit:cover; will-change:transform; }
.l0 { transform: translate3d(calc(var(--camX) * -6px), calc(var(--camY) * -4px), 0) scale(1.06); }
.l1 { transform: translate3d(calc(var(--camX) * -14px), calc(var(--camY) * -9px), 0) scale(1.10); }
.l2 { transform: translate3d(calc(var(--camX) * -24px), calc(var(--camY) * -14px), 0) scale(1.14); }
.l3 { transform: translate3d(calc(var(--camX) * -40px), calc(var(--camY) * -22px), 0) scale(1.20); }
```

GSAP 只改 `--camX/--camY`（从 -1 到 1），或用 timeline 的 progress 驱动；不要每帧 `Math.random()`。这样没有深度模型也能有真视差，而且文字/脸部不会被拉伸。

### 9.3 不需要 Whisper 的节拍网格

直接使用 `audio_features.npz`：

```python
import json
import numpy as np

d = np.load("audio_features.npz")
t, flux, bpm = d["t"], d["flux"], float(d["bpm"])
period = 60.0 / bpm
dt = float(t[1] - t[0])
phases = np.arange(0.0, period, 0.005)
score = []
for ph in phases:
    grid = np.arange(ph, t[-1], period)
    idx = np.clip(np.rint(grid / dt).astype(int), 0, len(flux) - 1)
    score.append(float(flux[idx].sum()))
phase = float(phases[int(np.argmax(score))])
beats = np.arange(phase, t[-1], period).round(3).tolist()
json.dump({"bpm": bpm, "phase": phase, "beats": beats}, open("beats.json", "w"), indent=2)
```

本次快照得到 76 BPM、约 501 个 beat、相位约 0.43 秒；这只能当起点。把 `beats.json` 和现有 LRC 对照：**LRC 行首不动，新增的镜头内切点/字形落点才吸到最近半拍**。

### 9.4 纸/墨转场：用 Chromium 原生，不用模型

- 纸纤维：现有 `assets/tex/paper.jpg` + `grain.png`，用 `mix-blend-mode: multiply/soft-light`，不要新生成纹理。
- 墨晕：SVG `<feTurbulence>` + `<feDisplacementMap>`，固定 `seed`；比视频模型稳定，也能逐帧渲染。
- 纸张翻页：CSS `clip-path` / `mask-image` 推进 + 轻微 `box-shadow`；不要追求真实 3D 纸，风格上更像印刷。
- 错版：两层同一画面，分别偏移 2–4px，用 `mix-blend-mode: multiply`，只在重拍出现 1–2 帧。
- 雪：Canvas/JS 粒子或 CSS 多层 PNG 漂移；雪速与镜头层速度分开。

### 9.5 排印：在 HyperFrames 里完成

- 以现有 `.tb-main .ch` 字符 span 为基础；每行用 `Intl.Segmenter` 拆分。
- 入场：`autoAlpha 0→1`、`yPercent 20–40→0`、`filter blur(6px)→0`，时长 0.5–0.9s，stagger 0.04–0.08s。
- 重拍强调：只对关键词/数字做 scale 1.0→1.06→1.0，不做全句抖动。
- 日文竖排/横排混排沿用现有 `Shippori Mincho` + `Klee One`；中文文学字幕用 `Noto Serif SC`。
- 字幕安全区：底部至少留 96px；竖排避开右侧 120px；红色只做重点，面积不超过 3%。

### 9.6 FFmpeg 最终组装

```powershell
# 1) 统一每个镜头的 fps/分辨率/像素格式后再 concat
ffmpeg -i .\shot01.mp4 -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -crf 18 -an .\norm\shot01.mp4

# 2) 生成 concat 列表（每行 file 'norm/shot01.mp4'）
ffmpeg -f concat -safe 0 -i .\shots.txt -c:v libx264 -crf 18 -pix_fmt yuv420p -an .\timeline.mp4

# 3) 回贴原曲；先确认长度，不要用 -shortest 截掉尾奏
ffmpeg -y -i .\timeline.mp4 -i .\audio_mono.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -movflags +faststart .\final.mp4

# 4) 抽 contact sheet 做 QA
ffmpeg -i .\final.mp4 -vf "fps=1/5,scale=480:-1,tile=4x4" -frames:v 1 .\qa_contact.jpg
```

- 如果 concat 后音画长度不一致：用 `ffprobe` 查 `duration`，补黑帧或 `-t 395.413`，不要直接 `-shortest`。
- 需要纸纹/颗粒：在最终编码前加 `noise=alls=4:allf=t+u,vignette=PI/5`；不要加太重的 `gblur`，会破坏线稿。
- 需要轻微锐化：`unsharp=5:5:0.5:5:5:0.0` 或 `cas=0.3`，先在 5 秒片段上看边缘。

### 9.7 没有 RIFE 的 60fps 方案

- 如果只是 UI/排印滚动不顺：用 HyperFrames 原生 60fps 渲染该镜头，不要补帧。
- 本项目没有 AI 生成的 24fps 片段；如引入外部 24fps 素材，才用 `minterpolate` 做 3 秒测试；有鬼影就保持 24fps 或减少快速横移。
- 不要为了 60fps 把全片 23,725 帧都展开；时间、磁盘和画质都不划算。

---

## 10. 安装与验收清单

### 10.1 安全安装顺序

1. 新建 `tools/optional/` 下的独立目录/venv；不要动项目 Python 环境。
2. 先装 **librosa**，跑 30 秒音频，输出 `beats.json`；确认无 PyTorch 依赖。
3. 下载 Real-ESRGAN ncnn Windows 包到 `tools/optional/realesrgan/`，只处理 1 张静帧；确认 Intel Vulkan 可用。
4. 如需 waifu2x，再放独立目录；RIFE 本轮不需要，不要先下载 412MB 的模型包。
5. 在安装 DepthFlow 前，向 Lead 报告 CPU PyTorch 的 wheel 体积、安装目录和预计磁盘占用；批准后再装，模型只下 DAv2-S（约 95MiB）。
6. 任何模型下载大于 1GB，先停下报告，不要先下后说。

### 10.2 试片验收门槛

| 工具 | 测试 | 通过标准 | 不通过怎么办 |
|---|---|---|---|
| DepthFlow | 1 张 hero 图，5 秒 1080p30 | 小于 15 分钟；无明显边缘撕裂；镜头运动可读 | 降到 720p 或直接用 2D 分层 |
| DAv2-S | 1 张 1920×1080 图 | 深度方向正确；人物/背景层次可读 | 手工画 3 层深度/遮罩 |
| Real-ESRGAN | 1 张 1280×720 角色图 2× | 小于 30 秒；线条不糊、无振铃 | 改用 waifu2x 或 FFmpeg Lanczos |
| RIFE（仅外部素材） | 2–3 秒 30→60fps 片段 | 小于 3 分钟；文字/线条无鬼影 | 保持 30fps，不补帧 |
| librosa | 6:35 音频 | 小于 2 分钟；beat 与手打拍子误差可接受 | 用现有 76 BPM 固定网格 + 手工微调 |
| Codex 图片资产 | 1 张 hero 静帧 | 分层/锚点/透明边缘符合 4.4 契约 | 让 Lead 重出或 2D rig 修 |

### 10.3 最终建议

- **主线**：HyperFrames + GSAP + FFmpeg，保持 28 场景结构，30fps 输出。
- **增强**：8–12 个 hero 镜头用 DepthFlow + DAv2-S；其余用 2D cutout 和现有纸纹/排印。
- **节奏**：librosa 生成 beat grid，但 LRC 行首不动；新切点最多吸到半拍。
- **角色**：2D rig + 角色圣经；不引入 InstantID/IP-Adapter。
- **后期**：Real-ESRGAN 只放静帧；不做视频补帧；不做全片图像序列处理。
- **预算**：本地工具 0 美元；图片/视频生成由 Lead 的 Codex 流程负责，不在本报告预算内。
- **风险控制**：DepthFlow 不通过就回退 2D；任何大于 1GB 的下载/ PyTorch 安装先报告。

---

## 11. 引用与数据来源

> 访问日期均为 2026-10-22。GitHub 星数/最近提交为当日公开页面快照；价格以供应商页面为准，可能随时变化。以下保留完整 URL，便于复核。

1. DepthFlow 仓库、许可、提交与 PyPI 依赖：  
   https://github.com/BrokenSource/DepthFlow  
   https://github.com/BrokenSource/DepthFlow/blob/main/license.txt  
   https://github.com/BrokenSource/DepthFlow/commits/main.atom  
   https://pypi.org/project/depthflow/
2. DepthFlow 估算器文档（DAv2 默认、模型许可警告）：  
   https://depth.tremeschin.com/docs/estimators/
3. DepthFlow 输入格式与导出/FFmpeg 文档：  
   https://depth.tremeschin.com/docs/inputs/  
   https://depth.tremeschin.com/docs/exporting/
4. DepthFlow Windows 帮助页：  
   https://depth.tremeschin.com/help/windows/
5. Depth Anything V2 仓库、模型大小与许可：  
   https://github.com/DepthAnything/Depth-Anything-V2
6. OpenVINO Depth Anything notebook（DAv1/DAv2、CPU/GPU、量化）：  
   https://github.com/openvinotoolkit/openvino_notebooks/tree/latest/notebooks/depth-anything
7. MiDaS 仓库：  
   https://github.com/isl-org/MiDaS
8. 3D Ken Burns 非商业许可（CC BY-NC-SA 4.0）：  
   https://github.com/sniklaus/3d-ken-burns/blob/master/LICENSE
9. Real-ESRGAN 仓库、ncnn 便携版说明与动漫视频模型：  
   https://github.com/xinntao/Real-ESRGAN  
   https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0
10. RIFE ncnn Vulkan 仓库与发布包：  
   https://github.com/nihui/rife-ncnn-vulkan  
   https://github.com/nihui/rife-ncnn-vulkan/releases/tag/20221029
11. waifu2x ncnn Vulkan 发布页：  
   https://github.com/nihui/waifu2x-ncnn-vulkan/releases
12. IP-Adapter 仓库、模型下载与 SD1.5/SDXL 依赖：  
   https://github.com/tencent-ailab/IP-Adapter
13. InstantID 仓库；官方 README 明确 checkpoint 研究用途、InsightFace 人脸模型非商业：  
   https://github.com/InstantID/InstantID
14. Beat This 仓库、模型大小、CPU/GPU 用法与许可：  
   https://github.com/CPJKU/beat_this
15. librosa 仓库与 ISC 许可：  
   https://github.com/librosa/librosa  
   https://github.com/librosa/librosa/blob/main/LICENSE.md
16. faster-whisper 仓库；CPU int8 基准与词级时间戳：  
   https://github.com/SYSTRAN/faster-whisper
17. WhisperX 仓库：  
   https://github.com/m-bain/whisperX
18. whisper.cpp 仓库：  
   https://github.com/ggml-org/whisper.cpp
19. Runway API Pricing（credits、Gen-4 Turbo、Kling 3.0、WAN 3、图像编辑）：  
   https://docs.dev.runwayml.com/guides/pricing/
20. music-mv 仓库（MIT；HyperFrames + FFmpeg；analyze_song.py 等）：  
   https://github.com/Win-Hao/music-mv
21. MusicVision 仓库（Apache-2.0；20GB VRAM 最低、100GB SSD、五阶段管线）：  
   https://github.com/tsondo/musicvision
22. BeatSync Engine 仓库与 AGPL-3.0 许可：  
   https://github.com/Merserk/BeatSync-Engine
23. MoneyPrinterTurbo 仓库（MIT；4GB RAM 最低；Windows 一键包）：  
   https://github.com/harry0703/MoneyPrinterTurbo
24. Songify.AI 仓库（README 为 AI Studio 模板、未见 LICENSE）：  
   https://github.com/akranjha0070-rgb/Songify.AI
25. stable-diffusion.cpp 仓库与 Wan2.1/Wan2.2 文档：  
   https://github.com/leejet/stable-diffusion.cpp  
   https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/wan.md
26. Bernini-R 1.3B OpenVINO 实验 notebook（约 12GB 下载、UMT5 约 5GB、20 帧 480×832、OpenVINO nightly）：  
   https://github.com/openvinotoolkit/openvino_notebooks/tree/latest/notebooks/bernini-r-image-video
27. Bernini-R 1.3B 模型卡（Apache-2.0、2026-06-09 开源）：  
   https://huggingface.co/ByteDance/Bernini-R-1.3B-Diffusers
28. Stable Video Diffusion XT 模型卡（25 帧、576×1024、community license）：  
   https://huggingface.co/stabilityai/stable-video-diffusion-img2vid-xt
29. Wan2.2 仓库（TI2V-5B 24GB VRAM、A14B 80GB、720p24）：  
   https://github.com/Wan-Video/Wan2.2
30. FramePack 仓库（6GB NVIDIA、Windows 一键包、大于 30GB 下载）：  
   https://github.com/lllyasviel/FramePack
31. LTX-Video 仓库（代码 Apache-2.0；权重 OpenRAIL-M 类）：  
   https://github.com/Lightricks/LTX-Video
32. FFmpeg filters 文档（zoompan、minterpolate、unsharp、cas、xfade 等）：  
   https://ffmpeg.org/ffmpeg-filters.html
33. Video2X 仓库（AGPL-3.0）：  
   https://github.com/k4yt3x/video2x
34. FILM frame interpolation 仓库（Apache-2.0）：  
   https://github.com/google-research/frame-interpolation
35. kohya-ss/sd-scripts（LoRA 训练脚本，Apache-2.0；基础模型许可另算）：  
   https://github.com/kohya-ss/sd-scripts
36. ControlNet WebUI 扩展（reference-only 等）：  
   https://github.com/Mikubill/sd-webui-controlnet

### 本地项目内证据

- `<工作目录>/koiirozora-mv\index.html`：28 个 scene + 3 个 overlay，`data-duration=395.413`，大量场景起点与 LRC 行时间一致。
- `<工作目录>/koiirozora-mv\research\lyrics_and_music.md`：26 条显示行时间码、76 BPM、结构/剪辑地图。
- `<工作目录>/koiirozora-mv\audio_features.npz`：17,026 个采样、`flux`、`bpm=76.0`。
- `<工作目录>/koiirozora-mv\research\visual_culture.md`：每个镜头至少两层运动 + 一次质感事件、2.5D 摄影机、印刷错版、动态日文排印等视觉约束。

---

### 最后说明

- 本报告没有安装任何依赖、没有下载任何大于 1GB 的模型、没有改动 `assets/`、`compositions/`、`renders/` 或现有项目代码。  
- 所有 `*_readme`、仓库元数据和派生的调研笔记只缓存在 `tools/optional/research_cache/`，便于复核。  
- 许可判断是工程风险提示，不是法律意见。公开发行前应单独核对：歌曲/录音版权、模型权重许可、字体许可、FFmpeg 构建许可，以及 AGPL/非商业条款。