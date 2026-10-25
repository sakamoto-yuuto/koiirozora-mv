代码修改已经完成，但**验证被宿主机级的 Windows 进程启动故障阻断**，因此我不能诚实地声称“已运行并通过”。先说明状态，以免把未执行的验证说成已通过。

## 已完成的修改

### 1. 运动（每个镜头都有持续位移/二级运动）
- **frost**：镜头持续推近；霜线改为连续推进，并在每拍额外跳动，增加第二道霜边；玻璃前加入按拍呼出的网点白气。
- **window**：镜头持续推；每小节一次车灯横扫，扫过时房间压暗，车灯网点带成为主光；她的头发墨版有独立漂移；窗外雪持续。
- **post-chorus**：重建为真正的加速蒙太奇。`157.01` 起每 2 拍切一次，`B(51)=164.21` 起每拍切；六种 reprint（street / hands / cups / table / counter / platform）交替 `度数 + 磁带计数器` 插页；单位从 47 逐次降到 41（始终 ≥ 40）；`B(53)=170.61` 进入收带镜头，磁带轮减速到停，REC 灯保持到 173.81。
- 其余镜头保留并加强了推拉、手持漂移、雪、呼吸、错版、磁带轮等运动。

### 2. platform
- 修正了原先把 `pull` 传给不存在的参数、导致列车其实没有移动的问题：现在用 `travel` + `speed` 驱动列车**加速向右拉走**，`ctx.trail` 产生整节车厢的运动模糊；起雾车窗和「さよなら」随车离开。
- 站台加亮：前景路灯 `dotCone`、亮边线、盲道、站名牌支柱「明星」、长椅/时刻表、站台灯池；他的琥珀点缩小并向暗处退去。
- 修正了 `dotCone is not defined`（memory.js 漏导入），这是原先 platform 镜头直接报错的原因。

### 3. voice（149.01–157.01）
- 删除横在脸上的巨大绿色听筒。
- 改为 `y_phone_eyesclosed` 的**头部+手部裁切**近景，听筒贴耳。
- 耳侧加大的网点 `声` 字，配合耳机孔环和脉冲。
- 她的歌词竖排在画面左侧，逐字按 `charTimes`。
- す・こ・し 各掉 1 单位（50→47）。
- 「…」三点每拍一个：第一点在 voice 末尾，后两点在 post 开头延续，位置与字列对齐。

### 4. table
- 七个实物（磁带、钥匙、杂志、花、手套、车票、伞）按对应字逐个离桌，八个 ghost 采样形成明显运动模糊，方向各不相同。
- 双杯在结尾有呼吸缩放、暖光脉动、蒸汽卷和按拍小颗粒，蒸汽从 97.64 起持续到切镜。
- 另外修正了 `02_v1.js` 中 `P` 未定义的问题（原代码在 v1-hands 会抛错）。

### 5. 其他
- post 的 reprint 全部带错版底层、crop marks、扫描带和切割闪光。
- `node tools/sfx.mjs` 的事件表已按新时间/新 cut 调整（但尚未能执行命令验证）。

## 验证状态（重要）
以下命令均**没有真正启动**，不是代码报错，而是宿主 Windows Job Runner 在创建进程前就崩溃：

```text
Error: subprocess-local: Windows Job runner exited with exit code 3221225794 before proving its managed range empty
```

`3221225794 = 0xC0000142 (STATUS_DLL_INIT_FAILED)`。我已实际尝试：
- `node --check src/scenes/02_v1.js`
- `node --check src/scenes/03_b1.js`
- `node --check src/scenes/04_c1.js`
- `node --check src/components/memory.js`
- `node tools/sfx.mjs`
- `node export/export.mjs --sheet out/t04b_beats_v1.png --from 74.61 --to 100.21 --step 0.8 --cols 6 --width 960 --height 540`
- 连 `Write-Output` / `cmd /c echo` 也同样失败，确认是宿主级故障，不是项目路径或 Node 的问题。

因此我**没有**生成新的逐拍缩图，也**没有**查看并据此迭代；这一步必须在 shell 恢复后补做。我保留了一个活动目标，下一轮会先重试 shell，恢复后立即执行完整验证与视觉迭代。
