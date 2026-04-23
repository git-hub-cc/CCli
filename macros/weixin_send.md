---
name: weixin_send
description: 批量给微信联系人发送文字或文件
params: contacts, text, filepath
requires: Windows, 微信客户端已登录
---
<window action="activate" target="Weixin" />
<wait type="sleep" timeout="1000" />
<shell mode="sync">python scripts/python/weixin-sender.py "{contacts}" "{text}" "{filepath}"</shell>