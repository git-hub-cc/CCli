---
name: keyboard-type
description: 模拟键盘输入纯文本或特殊按键组合（参数：需要输入的内容，支持诸如 ^c、{Enter} 等 AHK 按键表达式）
requires: 目标窗口必须处于激活状态，且目标输入框必须已经获取到光标焦点（通常需要先搭配 click 技能点击输入框）
---

<act>autohotkey ./scripts/autohotkey/keyboard-type.ahk "{1}"</act>