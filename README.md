# Momo

<div align="center">
    <img src="./doc/images/dark-light.jpg">
    <p>一个极简的Blog模板，使用 <a href="https://astro.build/">Astro</a> 搭建</p>
    <small><ins>简体中文</ins></small> <small><a href="./doc/README_en.md">English</a></small> 
</div>

## ✨ 特性

Momo 取自小红书📕，每个新用户最初的昵称，象征着初始新生。博客的设计理念也来自于此，从简约出发，在复杂功能与简约设计之间达到一种平衡。

* **极简设计**：页面设计简约，黑白为主色调，蓝色进行点缀
* **深色模式**：支持手动切换或自动跟随系统
* **照片封面**：首页第 1 页可用一整屏照片做封面，标题与副标题居中放大、叠一层可调的黑色蒙版；向下滚动时标题平滑落回原位、照片淡成整页底色，其余页面也会铺一层很淡的照片
* **客户端换页**：站内跳转由 [swup](https://swup.js.org/) 接管，不再整页刷新，带悬停预取、淡入淡出与「前进 / 后退回到原位置」
* **移动端适配**：组件针对移动端进行优化，拥有和电脑浏览器一样的流畅体验
* **图片体验**：点击图片打开灯箱；连续放置的多张图片自动拼成网格；文章内图片支持 LQIP 弥散渐变占位
* **丰富的 Markdown 语法**：KaTeX、Typst（构建期编译为 SVG）、Alert 提示块、GitHub / 网易云音乐卡片、引用组件、注音（Ruby）、折叠、彩虹文字、下划线、新标签页链接，Expressive Code 等
* **本地搜索**：使用 [pagefind](https://pagefind.app/) 实现本地化搜索，无需外部服务
* **国际化（i18n）**：支持多语言切换，目前支持简体中文、英文
* **评论功能**：支持本地部署和 Cloudflare 部署，具体参考 [Backend](https://github.com/Motues/Momo-Backend)；后端开启无感验证后，访客无需点选图片或输入验证码即可自动完成人机校验
* **SEO**：canonical、hreflang 多语言对照、Open Graph / Twitter Card、结构化数据、`sitemap.xml` 与 `robots.txt`
* **本地 CMS 管理后台**：`pnpm cms` 启动，可视化编辑文章、实时预览（与博客共用同一条 Markdown 管线）与网站配置，编辑页每 60 秒自动保存，无需手动改 Markdown
* **命令行工具**：`pnpm momo` 提供配置备份/恢复、一键更新、新建文章、环境检查等能力
* 其他基本功能：文章分类，目录，RSS订阅，字数统计，阅读时间

## 🚀 快速开始

> 环境要求：Node.js **>= 22**（推荐 24 LTS；本地 CMS 管理后台需要 **>= 22.18**），包管理使用 [pnpm](https://pnpm.io/zh/)

1. 克隆本项目
    ```bash
    git clone https://github.com/Motues/Momo.git
    cd Momo
    ```
2. 运行 `pnpm install` 安装依赖（使用 `npm install -g pnpm` 安装 `pnpm`）
3. 运行 `pnpm dev` 启动开发服务器

## 🔧 配置

参考 [配置指南](./doc/config_zh-cn.md)，详细信息可以访问 [Momo](https://momo.motues.top/intro/config)，阅读对应文章获取详细信息。

站点信息、主题开关、多语言与首页 Cover 文案统一在 `src/config.ts` 中配置；`astro.config.mjs` 的 `site` 与 `i18n` 会自动读取该文件的配置。

## 📚 更新

参考 [更新指南](./doc/release_zh-cn.md)，介绍如何更新项目，详细信息可以访问 [Momo](https://momo.motues.top/intro/release)。

执行 `pnpm momo update` 可以自动完成「检查 GitHub Release → 下载新版本源码 → 备份 → 覆盖代码 → 删除新版本已移除的旧文件 → 安装依赖」，并提示本次更新中需要手工合并的配置文件。你自己的文章与图片（`src/content`、`src/assets`、`public`）和 `src/config.ts` 会原样保留；删除只针对上一版模板里有、而新版本已移除的文件（依据更新时写下的 `.momo/manifest.json`，你自己新增的文件不受影响，加 `--no-delete` 可只覆盖不删除）。先加 `--dry-run` 可以只预览变更、不写入任何文件。国内直连 GitHub 超时也不用额外配置：它会自动并行探测 GitHub 直连与公共镜像并挑最快的下载，超时或镜像返回错误内容就自动换源（可用 `--mirror <镜像前缀>` 或环境变量 `MOMO_MIRROR` 指定镜像，`--mirror direct` 强制只用直连）。

## 🍃 分支

下面是一些分支，会不定期进行维护，无法保证与 `main` 分支一致

* `memos`：实现 Memos 卡片功能
* `v5`：v5 版本，已经停止维护

## ⚡ 指令

以下所有的指令可以在根目录下面执行

| 指令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动本地服务器，运行在 `http://localhost:4321` |
| `pnpm build` | 构建发布版本到 `./dist` 目录下（含 pagefind 搜索索引） |
| `pnpm preview` | 预览构建后的发布版本 |
| `pnpm astro ...` | 运行 `astro` 命令，例如 `astro add` |
| `pnpm cms` | 启动本地 CMS 管理后台，运行在 `http://localhost:5188`（首次使用前先执行 `pnpm install`） |
| `pnpm momo new [path]` | 新建文章，路径省略时按日期自动生成，例如 `pnpm momo new docs/test` |
| `pnpm momo backup` | 备份 `src/config.ts` 到 `.backup/`（加 `--config` 备份全部配置文件，加 `--all` 再连同文章内容与图片） |
| `pnpm momo restore [名称]` | 从备份恢复（默认最近一次） |
| `pnpm momo update` | 从 [GitHub Release](https://github.com/Motues/Momo/releases) 更新模板代码并同步依赖（保留自己的文章与图片，删除新版本已移除的文件；`--dry-run` 预览变更，`--no-delete` 只覆盖不删除，`--mirror` 指定下载镜像） |
| `pnpm momo clean` | 清理构建产物与缓存（加 `--all` 连同 `node_modules`） |
| `pnpm momo doctor` | 检查环境、依赖与项目状态 |
| `pnpm momo --help` | 查看全部 momo 命令与选项 |


## 📚 参考

* [Astro](https://astro.build/)
* [Fuwari](https://github.com/saicaca/fuwari)
* [Tyndall](https://github.com/moyuin-aka/tyndall-public)