---
name: app-wake
description: 唤起已在后台运行的应用主窗口，将其置于前台，有效防止因重复调用可执行文件导致的账号多开或登录冲突（参数：进程名称，使用list-running-apps）
requires: 目标程序必须处于运行状态（无论是在托盘还是最小化）
---

<act>python ./scripts/python/app-wake.py "{1}"</act>