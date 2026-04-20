---
name: browser-action
description: 根据分配的数字 ID 操控网页元素（参数：元素ID, 动作类型[Click/Fill/Select], 填入的文本值[当动作类型为Fill或Select时必填，否则留空]）
requires: 必须先执行 browser-scan 获取到目标元素的准确数字 ID。你所使用的 ID 必须源自系统反馈的真实扫描结果，严禁脱离反馈凭空猜测数字。若页面发生跳转或刷新，必须重新扫描。
---

<act>npx --yes tsx ./scripts/playwright/browser-action.ts "{1}" "{2}" "{3}"</act>