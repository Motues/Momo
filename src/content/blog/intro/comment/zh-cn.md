---
title: 部署评论系统
pubDate: 2026-01-08
description: 网站配置
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

评论系统也提供后台管理界面，支持审核和删除评论。


