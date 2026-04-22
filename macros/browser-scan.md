---
name: browser-scan
description: 扫描网页交互元素并分配数字ID。执行后须立即停止输出或用<continue>等待系统反馈
content: -
params: -
requires: 严禁凭空猜测元素ID执行动作
---

<act>npx --yes tsx ./scripts/playwright/browser-scan.ts</act>