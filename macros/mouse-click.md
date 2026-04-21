---
name: mouse-click
description: 屏幕绝对坐标点击
params: X, Y, 键[L/R/M], 次数
requires: 窗口须可见。未知坐标须先用screenshot(grid)获取
---

<act>autohotkey ./scripts/autohotkey/mouse-click.ahk "{1}" "{2}" "{3}" "{4}"</act>