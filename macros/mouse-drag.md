---
name: mouse-drag
description: 屏幕绝对坐标拖拽
content: 起点X, 起点Y, 终点X, 终点Y, 速度[0-100]
params: -
requires: 窗口须可见。坐标须通过screenshot(grid)获取，严禁猜测
---

<act>autohotkey ./scripts/autohotkey/mouse-drag.ahk "{1}" "{2}" "{3}" "{4}" "{5}"</act>