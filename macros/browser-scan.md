---
name: browser-scan
description: 扫描当前网页的可见交互元素（输入框、按钮、链接等），为其分配短数字 ID 并绘制红色高亮边框。注意：执行此技能后，你必须立即停止输出或使用 <continue> 标签等待系统反馈真实的元素列表，绝对禁止凭空猜测 ID 执行后续动作。(无参数)
requires: 必须先确保目标网页处于打开状态
---

<act>npx --yes tsx ./scripts/playwright/browser-scan.ts</act>