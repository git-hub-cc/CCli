---
name: feishu-send
description: 飞书发送消息/文件
content: 搜索词, 内容, 路径[可选]
params: -
requires: 飞书须运行且登录
---

<act>autohotkey ./scripts/autohotkey/feishu-send.ahk "{1}" "{2}" "{3}"</act>