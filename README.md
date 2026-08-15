# 牛马服一周年签名墙视觉原型

这是牛马服一周年纪念信和共享签名墙。前端托管于 GitHub Pages，签名通过 Cloudflare Tunnel 写入服务器上的 SQLite 数据库。

线上地址：<https://yabo083.github.io/niuma-anniversary-wall/>

直接打开 `index.html` 可以预览页面；由于 API 只接受线上站点来源，本地文件不能提交签名。

## 视觉方案

- `?variant=a`：星海长卷，单列沉浸式长文。
- `?variant=b`：岁月刻度，强调一年中的记录与节点。
- `?variant=c`：双声终诗，交替排版，最接近 Minecraft 终末之诗。

页面底部的原型切换器或键盘左右方向键可以切换方案。
