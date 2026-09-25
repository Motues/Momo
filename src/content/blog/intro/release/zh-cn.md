---
title: 更新指南和版本记录
pubDate: 2026-01-01
description: 网站配置
category: 指南
image: "./images/banner.png"
draft: false
slugId: momo/intro/release
pinTop: 1
---


该项目目前仍处于维护中，如果需要更新，请按照以下步骤进行：

首先在 `package.json` 中确认版本号，或者在这里或 [Release](https://github.com/Motues/Momo/releases) 中查看改动记录。

当只有项目的配置文件的结构修改后，才会对项目的版本号进行修改。项目配置文件即和网站布局内容相关的文件，包括`astro.config.mjs`、`src/config.ts`、`src/content.config.ts`、`src/i18n/`文件夹下的文件。

`src/content/`、`src/assets` 、`public` 文件夹下存放博客文字、图片等内容。

## 版本号未变

可以直接克隆本项目，然后将自己原本的配置文件覆盖到新项目，然后运行 `pnpm install` 安装依赖，然后运行 `pnpm build` 本地编译，然后运行 `pnpm preview` 预览编译后的项目。

在本仓库内更新时，可以直接执行 `pnpm momo update`：它会先备份配置文件到 `.backup/`，再拉取远端更新并安装依赖，最后列出本次更新中**需要手工合并的配置文件**。如果更新后配置出了问题，可以用 `pnpm momo restore` 回滚到更新前的配置。

## 版本号改变

每次版本号改变时，都会在这里更新的改动记录。更新需要参考具体的记录修改对应的配置文件。

下面是一般修改建议。

* **`astro.config.mjs` 修改**：一般直接覆盖即可，其中的 `site` 与 `i18n` 会自动读取 `src/config.ts` 的 `siteConfig.rootSiteUrl`、`i18nConfig.defaultLanguage`、`i18nConfig.supportedLanguages`
* **`config.ts` 修改**：需要按照要求更新填写 `config.ts` 中新添加或修改的配置信息
* **`content.config.ts` 修改**：一般为文章添加了新的 frontmatter 配置，需要按照要求对文章添加新的配置项
* **`src/i18n/` 修改**：一般为添加了新的国际化翻译，直接覆盖即可。注意各页面的 Cover 文案（`cover.title` / `cover.subTitle`）已迁移到 `src/config.ts` 的 `i18nConfig.translations` 中，请在那里修改为自己的信息

## 版本信息

> 版本号采用 `YY.MM.DD` 的格式

### 26.9.10

> 本次更新包含**破坏性配置变更**，请仔细阅读下面的更新说明！

* 统一配置文件 `config.ts`，统一管理默认语言、支持语言与各页面的 Cover 文案等
* 新增命令行工具 `pnpm momo`，支持备份配置，恢复，更新等功能
* 404 页面重新设计；页脚图标间距微调
* 统一工具函数的命名方式
* 更新 CMS 管理后台，修复读取文章信息慢的问题，文章列表支持列宽按内容自适应
* 本次更新对配置文件 `src/config.ts`、`src/i18n/language/*.ts`、`astro.config.mjs` 进行了修改：
    * `src/config.ts`：新增 `i18nConfig`，并为 `siteConfig` 添加 `rootSiteUrl`
    * `src/i18n/language/*.ts`：删除原 `cover` 字段，从 `config.ts` 中引用
    * `astro.config.mjs`：`site`、`i18n` 改为引用 `src/config.ts` 的配置
* 升级后需要清除本地缓存（`node_modules`、`.astro`、`dist`）再重新 `pnpm install`，可执行 `pnpm momo clean --all` 快速完成

### 26.8.15

> 本次更新具有破坏性更新，请仔细阅读下面的更新说明！

* 本次更新将项目从 Astro5 升级至 Astro7，旧版本已经归档至 `v5` 分支，且后续不再维护
* Astro7 要求 Node.js 版本 >= 22，建议使用 24 LTS 版本。升级后需要清除本地缓存（`/node_modules` 等文件夹），才可以进行本地编译和预览
* 本次修改对配置文件 `content.config.ts`，`astro.config.mjs` 进行修改
* 在升级后遇到任何问题欢迎提交 issue 进行反馈

### 26.8.12

* 首页文章卡片支持两种图片展示样式，并适配移动端
* 修复单语言情况下隐藏语言选择按钮问题
* 本次更新对配置文件 `config.ts` 进行了修改，添加了 `theme.postCard` 字段，更新时需要添加新的字段

### 26.6.2

* 评论组件支持博主徽章标识和管理员评论，支持分页加载更多评论，多条回复折叠等功能
* 添加脚注样式支持
* 修复页面切换时的颜色闪烁问题，优化部分UI
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.verificationRequired` 等字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.5.6

* 添加 `LQIP` 低质量图像占位符功能
* 增加新的 Markdown 样式支持：++下划线语法++
* 添加样式配置选项
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，引入 `remarkLqip` 插件；对配置文件 `config.ts` 进行了修改，添加了 `theme.LQIP` 等字段，更新时需要添加新的字段

### 26.5.3

* 添加评论回复预览功能
* 增强评论内容安全性
* 修复 `astro.config.mjs` 类型错误
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，修改 `AdmonitionComponent` 导入方式，需要修改对应改动

### 26.4.27

* 评论系统支持 Markdown 语法
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.write` 等字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.4.21

* 添加 AOS 动效开关配置
* 评论系统支持 Twikoo
* 本次更新对配置文件 `config.ts` 进行了修改，添加了 `theme.AOS` 和 `comments.platform` 字段，更新时需要添加新的字段

### 26.4.15

* 添加文章置顶功能
* 更新音乐卡片 API 地址
* 修复部分样式问题
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，添加了新的依赖 `@iconify-json/fluent`，需要添加对应字段，并运行 `pnpm install`

### 26.4.7

* 修改翻译错误
* 修改选中文本的颜色
* 修改 Mucis Card 的 API 地址
* 本次更新对配置文件 `src/i18n/language/en.ts` 进行了修改，修改了`themeInfo.system` 字段，其余字段保持不变；更新时只需要修改变化的字段即可

### 26.3.29

* 更新评论数据结构，适配新版本的评论后台
* 优化评论在移动端的样式
* 修复归档页面分类菜单样式错位的问题
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.replyTo` 字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.3.17

* 修改评论头像的样式为圆形
* 调整部分组件的边距
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`themeInfo` 字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.3.11

* 首次发布版本号 `26.3.11`
* 对项目多处进行修改，包括：优化移动端体验、对网站色彩进行统一
* 本次更新对配置文件 `src/i18n/` 进行了修改，建议使用最新的版本，然后修改 `cover.title` 和 `cover.subtitle` 字段为自己的信息
