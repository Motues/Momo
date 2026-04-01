---
title: 更新指南和版本记录
pubDate: 2026-03-11
description: 网站配置
category: 指南
image: "./images/banner.png"
draft: false
slugId: blog/intro/release
---


该项目目前仍处于维护中，如果需要更新，请按照以下步骤进行：

首先在 `package.json` 中确认版本号，或者在这里或 [Release](https://github.com/Motues/Momo/releases) 中查看改动记录认。

当只有项目的配置文件的结构修改后，才会对项目的版本号进行修改。项目配置文件即和网站布局内容相关的文件，包括`astro.config.mjs`、`src/config.ts`、`src/content.config.ts`、`src/i18n/`文件夹下的文件。

`src/content/`、`src/assets` 、`public` 文件夹下存放博客文字、图片等内容。

## 版本号未变

可以直接克隆本项目，然后将自己原本的配置文件覆盖到新项目，然后运行 `pnpm install` 安装依赖，然后运行 `pnpm build` 本地编译，然后运行 `pnpm preview` 预览编译后的项目。

## 版本号改变

每次版本号改变时，都会在这里更新的改动记录。更新需要参考具体的记录修改对应的配置文件。

下面是一般修改建议。

* **`astro.config.mjs` 修改**：一般直接覆盖即可，然后修改 `siteConfig` 中的 `site` 字段和 `i18n` 字段为自己的信息
* **`config.ts` 修改**：需要按照要求更新填写 `config.ts` 中新添加或修改的配置信息
* **`content.config.ts` 修改**：一般为文章添加了新的 frontmatter 配置，需要按照要求对文章添加新的配置项
* **`src/i18n/` 修改**：一般为添加了新的国际化翻译，直接覆盖即可，然后注意修改 `cover.title` 和 `cover.subtitle` 字段为自己的信息

## 版本信息

> 版本号采用 `YY.MM.DD` 的格式

### v26.3.29

* 更新评论数据结构，适配新版本的评论后台
* 优化评论在移动端的样式
* 修复归档页面分类菜单样式错位的问题
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.replyTo` 字段，其余字段保持不变；修改时只需要添加新的字段即可

### v26.3.17

* 修改评论头像的样式为圆形
* 调整部分组件的边距
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`themeInfo` 字段，其余字段保持不变；修改时只需要添加新的字段即可

### v26.3.11

* 首次发布版本号 `v26.3.11`
* 对项目多处进行修改，包括：优化移动端体验、对网站色彩进行统一
* 本次更新对配置文件 `src/i18n/` 进行了修改，建议使用最新的版本，然后修改 `cover.title` 和 `cover.subtitle` 字段为自己的信息
