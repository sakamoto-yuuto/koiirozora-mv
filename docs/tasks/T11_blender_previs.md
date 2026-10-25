# T11 Blender 预演试点（工具任务：粗模、机位、示意图渲染；不碰成片画面）

恋色空 MV 的成片是"代码合成的生成版画"：每个人物、道具、背景都是 image_gen 生成的三墨版画，代码负责光、雪、视差、镜头和字。问题是生成图在同一地点的不同机位、人物连续动作上不可控。本任务用 Blender 做**预演 / 布局**：粗模 + 机位 + 姿势，渲出示意图，作为之后生图的第一参考图。**不要求精细，粗糙即可；最终验收由导演（Claude）做。**

先读：`docs/STORYBOARD_v2.md`（含 v2.1 修订）、`research/phone1986.md`、`assets/ref_official/touya/SOURCES.md`，看这些参考图：`art_src/v2/bg_street_night.png`（商店街夜景，电话亭在右三分之一）、`art_src/v2/bg_booth_front.png`（同一座电话亭正面）、`art_src/v2/bg_his_room_night2.png`（他的六叠房间）、`assets/ref_official/touya/c20081208_whitealbum_1_10_cs1w1_700x495.jpg`（冬弥三视图）、`assets/ref_official/anime2009/c20081112_wa_02_cs1w1_700x495.jpg`（由綺设定）、`art_src/v2/y_walk_sheet.png`（由綺走路四帧，雪天户外穿牛角扣大衣）。

Blender：`D:\Blender\blender-5.2.2-windows-x64\blender.exe`，后台运行 `blender -b --factory-startup --python <script>`。沙箱只能写项目目录：把 `BLENDER_USER_CONFIG`、`BLENDER_USER_SCRIPTS`、`TEMP`/`TMP` 指到 `blender/_tmp/`。

## 要做（全部用 Python 脚本生成，可重复运行）
1. `blender/build_previs.py` → `blender/previs.blend`，按 1986 年东京的尺度（米）建：
   - **商店街**：两层店铺两排（卷帘门、雨棚、二楼窗）、电线杆与下垂电线、路灯、积雪的地面和雪堆；**电话亭**（1985 型：棕色铝框、三面玻璃、顶灯，内壁上挂绿色公用电话，旁边小台子）放在街右侧，构图尽量接近 `bg_street_night.png`。
   - **电话亭内部**可单独渲（玻璃可隐藏）。
   - **他的房间**：六叠和室、矮桌（桌上电话和留言机）、门、门边空衣钩、窗、书架、叠起的被褥，接近 `bg_his_room_night2.png`。
   - **人物粗模**：由綺（约 160 cm，长直发及胸，牛角扣大衣，窄裤，短靴）和冬弥（约 175 cm，窄肩长腿，及大腿的外套，背后浅色帽兜）。用简单几何体 + 一套骨架（脊柱、头、肩肘腕、指根到指尖的 5 根手指简化骨、髋膝踝），能摆姿势。头发、衣服用块面表示即可。
2. `blender/render_guides.py <shot.json>`：按镜头描述（相机位置 / 目标 / 焦距、人物姿势或动作帧、隐藏哪些物体）渲出三种示意图，PNG，1672×941（竖构图 941×1672）：
   - `*_line.png`：白底黑线（Freestyle 或描边），人物左侧肢体蓝、右侧红；
   - `*_clay.png`：灰模，平光加一盏主光；
   - `*_depth.png`：归一化深度（近白远黑）。
3. **试点镜头**（每个都写成 `blender/shots/*.json` 并渲出来，存到 `blender/out/`）：
   - `street_wide`：街景广角，构图接近 `bg_street_night.png`，由綺站在左半边街上；
   - `walk_cycle_side`：由綺正侧面走路循环 4 帧（contact / down / passing / up），四帧并排在一张图里（和 `art_src/v2/y_walk_sheet.png` 的排法一样），每帧两只手清楚；
   - `walk_back_pair`：两人背影并肩走向远处、牵手（她左手牵他右手），4 帧循环并排；
   - `booth_inside_over_shoulder`：在亭内、她肩后看向墙上的公用电话，她右手按键；
   - `his_room_from_door`：从门口看他的房间，矮桌在画面中部。
4. 渲出一张总览图 `blender/out/contact.png`（所有试点镜头的 line 版拼图）。

## 规则
- 只写 `blender/**` 和 `docs/tasks/T11.result.md`。**不许动** `src/**`、`assets/**`、`art_src/**`、`config.json`、`export/**`、`tools/**`。
- 不需要生成任何图片（不要调用 image_gen）；只建模、摆姿势、渲染示意图。
- 结果写到 `docs/tasks/T11.result.md`：做了什么、每个文件、怎么改一个镜头的机位或姿势（给例子）、已知问题。不提交 git。只按 PID 杀你自己启动的进程。
