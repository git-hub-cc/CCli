---
name: keyboard-type
description: 模拟键盘输入
params: 文本或AHK按键表达式如^c/{Enter}
requires: 目标窗口须激活且输入框已获焦点(可先用click)
---

<act>autohotkey ./scripts/autohotkey/keyboard-type.ahk "{1}"</act>