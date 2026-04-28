---
name: weixin_send_image
description: 通过微信发送公开图片外链 (在调用前需使用 cloud 标签生成 url)
params: url, filename
---
<network action="post" url="http://127.0.0.1:9800/bot/v1/message/send" headers='{"Content-Type":"application/json", "Authorization":"Bearer app_1adf4ba155c488de9de5da6a31b33acc7971ca8dd1f7cb97c7669ef797c882c2"}'>
{
  "type": "image",
  "url": "{url}",
  "filename": "{filename}",
  "content": "{_content_}"
}
</network>