---
name: 基础文件操作与命令执行测试
tags: [file, act]
expect_status: success
expect_keywords: ["全量覆盖写入", "标准输出"]
---

<file path=".ccli/test-sandbox/hello.js" type="all">
console.log("Hello Test Sandbox");
</file>

<act>node .ccli/test-sandbox/hello.js</act>