已完成 T07 的四个场景与天空组件：

- [09_bridge.js](src\scenes\09_bridge.js)：电话亭开门、退卡、她离开并在路灯节拍下连续横移。
- [10_c3.js](src\scenes\10_c3.js)：户外字形雪落在她身上，随后切至他漆黑的窗外与白色呼气。
- [11_koi.js](src\scenes\11_koi.js)：唯一渐变的恋色天空、仰视人物、按字符时间落下的四张纸签。
- [12_outro.js](src\scenes\12_outro.js)：沿电线回到留言机、用件 2 闪烁、琥珀手按再生、晨街脚印与淡出字幕。
- [sky.js](src\components\sky.js)：仅供恋色天空及其后段调用的渐变、电话线、纸签组件。

美术资产：`y_back_full`、`y_profile_down`、`y_profile_up`、`h_press`；桥段没有注册 `y_walk_back`，已按要求回退到背影资产。音效种类：`door`、`step`、`hum`、`breath`、`relay`、`tape`。

验证完成：所有新文件语法检查通过；场景注册加载到 8 个 T07 镜头；无画布依赖的渲染路径逐镜头执行通过；`node tools/sfx.mjs` 已生成 232 条有效事件。

接触表与 326/385 全尺寸帧的导出曾尝试执行，但当前环境拒绝本地导出服务器端口（`127.0.0.1:5181`），因此未生成可供目检的图片。未提交。