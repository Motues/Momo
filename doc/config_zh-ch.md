# Momo 配置指南

文章的配置文件主要为`astro.config.mjs`和`src/config.ts`

## `astro.config.mjs`

* `site`: 网站的URL
* `markdown`
    * `shikiConfig`: 代码块的样式，可以参考Astro的文档[Shiki](https://docs.astro.build/en/guides/syntax-highlighting/#setting-a-default-shiki-theme)

## `src/config.ts`

### `siteConfig`

* `title`: 网站的标题
* `subTitle`: 网站的副标题
* `cover`
    * `enable`: 是否启用
    * `title`: 封面的标题
    * `subTitle`: 封面的副标题
* `favicon`: 网站的图标
* `pageSize`: 每页显示的文章数量
* `toc`
    * `enable`: 是否启用目录
    * `depth`: 目录的深度

### `profileConfig`

* `avatar`: 头像
* `name`: 名字
* `description`: 描述
* `indexpage`: 个人页面首页

### `licenseConfig`

* `enable`: 是否启用License，展示在文章的最后
* `name`: License名称
* `url`: License的URL

### `friendLinkConfig`

* `name`: 友链名称
* `avatar`: 友链图标
* `url`: 友链URL
* `description`: 友链描述
