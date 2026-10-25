# 交接（2026-10-23）

## 进度
- **v2 全部 12 段都已重做，用户逐段看过并通过**：前奏 01、V1 02、B1 03、C1 04、断线 05、V2 06、B2 07、C2 08、桥段 09、C3 10、恋色の空 11、尾奏 + 片尾 12。
- 全片：`out/恋色空_v2_全片_720p.mp4`（0–395.41 秒，1280×720，30 fps）。每段单独审片用的文件是 `out/恋色空_v2_<段名>段_720p.mp4`。
- 剧本以 `docs/STORYBOARD_v2.md` 顶部为准，优先级是 v2.2 > v2.1 > 正文。v2.2 是后半段的两条线：她往外走，他往家赶，擦肩而过，参考原片第四集「すれ違い」，见 `原片第四集-すれ違い/`。

## 后半段的实际做法（与分镜文字有出入的地方）
- **恋色の空**：
  - 电线杆是生成素材 `fg_pole_near`。代码画的电线从素材里电线伸出画面的地方接出去，走向一致，越远画得越细。
  - 纸签是一张空白短册 `obj_tanzaku`，同一个元素用四次，字由代码印上去。
  - 停住的那一小节，后两拍切到冬弥背影抬头看同一片天：`yt_back_bust` 切到 `yt_look_up`。
- **尾奏**：
  - 外景：他在二楼门口（`his_enter_back`，按走廊栏杆顶裁掉下半身），进门后他的黑窗亮起。亮窗是把邻居家那扇亮窗复制进去的。
  - 屋里开灯：调色盘是 `night` 与 `memory` 按 0.4 混合。他穿着大衣站在矮桌前，肩上的雪往下掉；接两个凉杯子的特写，再接他低头的背影。
  - 留言机长镜头：「用件」下的红色「2」随拍子闪；手指停两拍，按下机器自己的「再生」键，键被压下并保持按下。
  - 磁带放出她唱的第一句：音效类型 `voice`，取自人声分轨 `vocals.wav` 75.3–80.5 秒，经小喇叭滤波加磁带抖动。右侧竖排同步浮现「〔L1〕」，这次「黄昏」也印出来，因为画面里没有灯箱。
  - 原定的「大衣挂上衣钩」没有做：现有的按键手 `his_hand_press` 穿着大衣，做了会穿帮。
- **片尾**：
  - 清晨的俯视路口，用的是桥段那张 `bg_crossroad_top`：路灯那层墨换成雪色。
  - 两串脚印和桥段位置完全相同，透明度 0.6，表示被新雪盖了一半。
  - 片尾字幕加了描边，383 秒出现；387 秒歌词散成雪；390.4–392.4 淡成黑场。
- 镜头可以定义 `screen(ctx, t)`，在镜头变换之外画字（`shot.js` → `index.js` 的 overlay）。尾奏的竖排和片尾字幕用的就是它，推镜头时不会跟着缩放。

## 用户定下的规矩（都还有效）
- 镜头设计和实现由我（Claude）亲手做；codex / dsh 只做生图、工具、性能这类机械活。dsh 可以审分镜、做调研，最后由我判断。**不要一次启动大量 agent**，最多一两个帮手。
- 每个画面不看文档也能看懂。冬弥只露背影和局部，永远不露脸，严格按官方三视图（`assets/ref_official/touya/`）。
- 只有一个美术层：人物、路人、背景都是 codex 生成的三墨版画；代码只负责光、雪、视差、镜头和字。路人画得比主角简单。
- 同一道具只用一份素材（电话 `obj_phone_panel`，留言机 `obj_machine_*`）。手、道具、人物是独立元素，由代码合成；要配合的地方先用 `tools/guide.py` 画示意图再生成。审图时放大数手和关节。
- 走路要有真正的走路循环；跨镜头时位置按全片时间连续，不能每个镜头从头走。
- 字幕只有右侧竖排一套。只有 4 个主角字落在实物上：雾玻璃上的「恋色空」、灯箱「黄昏」、毛笔「寂」、纸签「恋色の空」，落在实物上时竖排里留空。歌词以歌ネット原文为准。
- **歌词时刻 = 用户手工打点**，流程是 `tools/tap.html` → `out/tap/manual_taps.json` → `tools/refine_taps.py` → `data/lyrics_film.json`。给用户的工具要尽量简单。
- 效率优先：看不出差别的不抠；只渲染正在审的那一段，用户说「继续做 X」再往下做。

## 工具速查
- 增量渲染（推荐）：`node tools/render_film.mjs --start S --end E --jobs 2|3 --out out/x.mp4 [--dry] [--force]`。按段切成不超过 16 秒的小片，用代码闭包和素材算指纹，没改的小片直接复用；无损拼接后再混入 `assets/audio/mix.wav`。缓存在 `out/_segments/1280x720_30/`。改了 `kit.js`、`shot.js`、`index.js`、`stage.js` 这类共用代码，会导致所有段都重渲。
- 缩图审片：`tools/sheet.sh <名字> <逗号分隔的时间> [列数]` → `out/<名字>.jpg`。背景在各调色盘下的样子：`node export/export.mjs --lab bg --sheet out/x.png --times ...`。
- 节拍表：`node tools/beatmap.mjs <from> <to>`。BPM 75，每小节 3.2 秒；`cues(env)` 里的 `B(n)` 是小节线，`P` 是一拍（0.8 秒）。
- 音效：`node tools/sfx.mjs && .venv/Scripts/python tools/make_sfx.py`。音效类型：step door tick hum breath squeak lift card dialtone dtmf key ringback bell relay tape beep busy crowd voice。歌曲本身从不做增益；限幅前峰值约 1.09，由软限幅压到 0.999。
- 生图：`art_src/v2/make_jobs.py <batch>` 生成提示词（必须是 LF 换行），`art_src/v2/run.sh <name>` 生成，改图用 `run_edit.sh <name> <src>`，逐张审图记在 `art_src/v2/REVIEW.md`，入库用 `.venv/Scripts/python art_src/v2/ingest.py <name>`。
- codex 跑代码：`codex exec --ephemeral --skip-git-repo-check -s workspace-write -m gpt-5.6-terra -c model_reasoning_effort=high -C <项目> -o <结果文件> "<任务>" < /dev/null`。一定要加 `< /dev/null`。
- dsh：`DSH_PERMISSION_MODE=danger-full-access NODE_OPTIONS=--max-old-space-size=8192 dsh headless "<任务>" < /dev/null`。进程开太多会崩（0xC0000142）。
- 已知坑：
  - codex 沙箱生成的文件只能删、不能覆盖写；
  - libsndfile 打不开非 ASCII 的绝对路径，要用相对路径；
  - 用 PowerShell 按命令行关键词杀进程时，会连带杀掉当前 shell。

## 还没做 / 可选
- 1080p 成片：目前只导出了 720p。
- 进度看板升级：T10 任务书 `docs/tasks/T10_dashboard.md` 已写好，还没启动。
- 自动对齐研究（T12 / R02）的结果还没看。用户的打点已经够用，这一项不急。
- 早先记下的小问题，v2 重做后还没逐项复查：写标题的手指偏小；街上路人太远。
