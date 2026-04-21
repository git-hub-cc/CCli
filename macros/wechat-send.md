---
name: wechat-send
description: 微信发送消息/文件
params: 搜索词, 消息, 路径[可选]
requires: 微信须已启动且登录
---

<act>autohotkey ./scripts/autohotkey/wechat-send.ahk "{1}" "{2}" "{3}"</act>