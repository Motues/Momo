---
title: 部署评论系统
pubDate: 2026-01-08
description: 网站配置
category: 指南
image: ""
draft: false
slugId: momo/intro/comment
---

Momo 支持添加评论功能，并提供两种部署方式，支持零服务器部署。详情访问仓库[Momo-backend](https://github.com/Motues/Momo-Backend)。

::github{repo="Motues/Momo-Backend"}

## 配置

如果需要启用评论功能，需要先部署后端评论系统，具体参考 Momo-backend 仓库。

部署完成后，在 `src/config.ts` 文件中，将 `comments.enable` 设置为 `true`，并填写 `comments.backendUrl` 为后端的URL，即可开启评论功能。

## 运行

评论组件使用 Svelte 编写，参考大部分的评论系统，需要输入昵称和邮箱（用于通知）进行评论，可以选择填写网址。

## 自定义前端

如果需要在其他项目里面使用评论功能可以直接通过 CDN 引入，使用方法如下，具体可以参考仓库[Momo-backend](https://github.com/Motues/Momo-Backend)。

```html
<div id="momo-comment"></div>

<script src="https://cdn.jsdelivr.net/npm/@motues/momo-comment@1.1.x/dist/momo-comment.min.js"></script>
<script>
    momo.init({
        el: '#momo-comment', // 评论容器的 id
        title: 'Test', // 文章标题
        slugId: 'blog/test', // 文章的唯一 slugId
        lang: 'zh-cn', // 语言，目前支持 zh-cn, en
        apiUrl: 'https://api-momo.motues.top' // 后端地址
    });
</script>
```

> 建议使用版本号锁定版本，避免版本更新导致冲突

评论系统也提供后台管理界面，支持审核和删除评论。

## 自定义样式

目前可以修改评论组件的颜色，后续会推出自定义样式的功能。颜色通过设置全局变量来修改，并且支持黑暗模式。

```css
:root {
    --momo-text-color: #d51111;            /* 文字颜色 */
    --momo-button-border-color: #e5e5e5;   /* 按钮边框颜色 */
    --momo-button-hover-bg-color: #f5f5f5; /* 按钮背景颜色（hover 状态）*/
    --momo-link-color: #003b6e;            /* 链接颜色 */
}
/* 暗色模式 */
[data-theme="dark"] { 
    --momo-text-color: #3ad8d8;
    --momo-button-border-color: #2e2e2e;
    --momo-button-hover-bg-color: #3c3c3c;
    --momo-link-color: #fff;
}
```


