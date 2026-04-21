---
name: browser-wait
description: 等待网页加载就绪
params: 状态[load/dom/network 默认network], 超时ms
---

<act>npx --yes tsx ./scripts/playwright/browser-wait.ts "{1}" "{2}"</act>