---
name: browser-goto
description: 控制自动化浏览器跳转到指定的 URL 网址（参数：目标URL）。建议在此动作后配合 <browser-wait> 和 <browser-scan> 开启观察流。
requires: 无，如果自动化浏览器未启动，底层会自动拉起
---

<act>npx --yes tsx ./scripts/playwright/browser-goto.ts "{1}"</act>