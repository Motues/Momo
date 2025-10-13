---
title: Momo 配置指南
pubDate: 2025-09-28
description: 网站配置
image: ""
draft: false
---

## 网站信息配置

网站的配置文件主要为`astro.config.mjs`和`src/config.ts`

### `astro.config.mjs`

* `site`: 网站的URL
* `i18n`: 国际化配置
    * `locale`: 支持的语言
    * `defaultLocale`: 默认语言
* `markdown`
    * `shikiConfig`: 代码块的样式，可以参考Astro的文档[Shiki](https://docs.astro.build/en/guides/syntax-highlighting/#setting-a-default-shiki-theme)

### `src/config.ts`

#### `siteConfig`

* `title`: 网站的标题
* `subTitle`: 网站的副标题
* `favicon`: 网站的图标
* `pageSize`: 每页显示的文章数量
* `toc`
    * `enable`: 是否启用目录
    * `depth`: 目录的深度

#### `profileConfig`

* `avatar`: 头像
* `name`: 名字
* `description`: 描述
* `indexpage`: 个人页面首页

#### `licenseConfig`

* `enable`: 是否启用License，展示在文章的最后
* `name`: License名称
* `url`: License的URL

#### `friendLinkConfig`

* `name`: 友链名称
* `avatar`: 友链图标
* `url`: 友链URL
* `description`: 友链描述

## 国际化配置

国际化配置文件位于 `src/i18n/` 文件夹中

如果需要修改首页或者其他页面的Cover内容，可以在 `src/i18n/language` 文件夹下对应的文件夹修改；只需要修改对应的`cover.title`和`cover.subtitle`字段即可