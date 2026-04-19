---
name: mouse-hover
description: 模拟鼠标移动到屏幕绝对坐标并保持悬停（参数：X坐标, Y坐标, 悬停时间[可选 默认1000毫秒]）
requires: 目标窗口必须位于前台可见状态，需先通过 screenshot 配合 grid 获取带坐标网格的截图
---

<act>autohotkey ./scripts/autohotkey/mouse-hover.ahk "{1}" "{2}" "{3}"</act>