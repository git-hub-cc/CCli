---
name: mouse-click
description: 模拟鼠标在屏幕绝对坐标进行物理点击（参数：X坐标, Y坐标, 按键类型[可选 Left/Right/Middle 默认Left], 点击次数[可选 默认1]）
requires: 目标窗口必须位于前台可见状态，如果不知道目标坐标，需先通过 screenshot 配合 grid 获取带坐标网格的截图
---

<act>autohotkey ./scripts/autohotkey/mouse-click.ahk "{1}" "{2}" "{3}" "{4}"</act>