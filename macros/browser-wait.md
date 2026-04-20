---
name: browser-wait
description: 挂起流程，精确等待网页加载就绪或网络请求完成，消除因异步渲染导致的执行失败（参数：状态条件[load/domcontentloaded/networkidle 默认 networkidle], 超时毫秒数[可选 默认 15000]）
---

<act>npx tsx ./scripts/playwright/browser-wait.ts "{1}" "{2}"</act>