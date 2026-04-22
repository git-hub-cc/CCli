---
name: browser-wait
description: 等待网页加载就绪
content: 状态[load/dom/network 默认network], 超时ms
params: -
---

<act>npx --yes tsx ./scripts/playwright/browser-wait.ts "{1}" "{2}"</act>