---
name: mouse-scroll
description: 模拟鼠标滚轮进行物理滚动（参数：滚动方向[Up/Down], 滚动次数[可选 默认1]）
requires: 目标窗口必须位于前台并处于激活状态，且鼠标光标需要在可以滚动的区域内
---

<act>autohotkey ./scripts/autohotkey/mouse-scroll.ahk "{1}" "{2}"</act>