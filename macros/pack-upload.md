---
name: pack-upload
description: 挂载多个文本文件，不支持目录，不支持通配符，不支持*，不支持.。（参数：一个或多个文本文件路径）
---

<act>python ./scripts/python/pack.py "{1}"</act>
<upload path="res.md" grid="false" />