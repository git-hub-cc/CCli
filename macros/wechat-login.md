---
name: wechat-login
description: 登录已打开的微信
content: -
params: -
requires: 微信主程序须已启动
---

<act>autohotkey ./scripts/autohotkey/wechat-login.ahk</act>
<act>python -c "import time; time.sleep(5)"</act>