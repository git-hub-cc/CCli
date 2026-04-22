---
name: pack-upload
description: 自动过滤屏蔽项并合并打包挂载文本
content: 文件或目录路径，多个用逗号分隔
params: -
---

<act>python ./scripts/python/pack.py "{0}"</act>
<upload path="res.md" grid="false" />