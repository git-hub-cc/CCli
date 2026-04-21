---
name: screenshot
description: 截图，（参数：软件名称（desktop-截图桌面））
requires: 如果是软件，窗口必须处于打开状态
---

<act>python ./scripts/python/screenshot.py "{1}"</act>
<upload path="./screenshot.png" grid="true" />