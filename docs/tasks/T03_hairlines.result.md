已完成 T03，仅改动：

- [world.js](src/components/world.js)：街景屋檐/窗框，电话亭框架、玻璃与招牌，亭内竖框、电话簿、链条与搁板，房间窗框、窗帘褶线、桌沿，家用电话与留言机的面板缝和按键描边。
- [phone.js](src/components/phone.js)：MC-3P 机身倒角、键盘槽、各插槽边框及说明牌细字线。

新增描边均为低透明度 `text` / `ice`，并会按 `ctx.at` 局部缩放反向补偿线宽。

验证完成：

- `node --check src/components/world.js`
- `node --check src/components/phone.js`
- 编辑前后联系表已生成并目视检查：[before](out/t03_before.png)、[after](out/t03_after.png)

未提交。