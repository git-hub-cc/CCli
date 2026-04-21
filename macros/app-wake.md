---
name: app-wake
description: 唤起后台进程窗口至前台。防止重复启动导致的冲突
params: 进程名
requires: 目标程序须运行
---

<act>python ./scripts/python/app-wake.py "{1}"</act>