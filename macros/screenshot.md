---
name: screenshot
description: 截图并挂载
params: 窗口标题或desktop
requires: 截取特定软件时目标窗口须已打开
---

<act>python ./scripts/python/screenshot.py "{1}"</act>
<upload path="./.ccli/image/screenshot.png" grid="true" />