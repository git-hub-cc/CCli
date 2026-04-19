---
name: screenshot
description: 截图（参数：软件名称,图片保存路径），desktop-当前窗口
requires: 目标窗口必须处于打开状态
---

<act>python ./scripts/python/screenshot.py "{1}" "{2}"</act>
<upload path="{2}" grid="true" />