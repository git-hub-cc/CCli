---
name: mouse-drag
description: 模拟鼠标在屏幕绝对坐标之间进行物理拖拽（参数：起点X, 起点Y, 终点X, 终点Y, 拖拽速度[可选 0-100 默认10]）
requires: 目标窗口必须位于前台可见状态，必须先通过 screenshot 配合 grid 获取带坐标网格的截图，明确起点和终点的精确物理坐标，严禁凭空猜测
---

<act>autohotkey ./scripts/autohotkey/mouse-drag.ahk "{1}" "{2}" "{3}" "{4}" "{5}"</act>