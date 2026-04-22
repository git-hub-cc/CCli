---
name: browser-action
description: 操控网页元素。注: ID须来自browser-scan反馈
content: ID, 动作[Click/Fill/Select], 文本
params: -
requires: 严禁脱离反馈凭空猜测ID。页面跳转或刷新后须重扫
---

<act>npx --yes tsx ./scripts/playwright/browser-action.ts "{1}" "{2}" "{3}"</act>