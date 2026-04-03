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
* **文章搜索功能**：使用 [pagefind](https://pagefind.app/) 实现本地化搜索功能
* **国际化（i18n）**：支持多语言切换，目前支撑简体中文、英文
* **移动端适配**：组件针对移动端进行优化，拥有和电脑浏览器一样的流畅体验
* **评论功能**：支持本地部署和 Cloudflare 部署，具体参考 [Backend](https://github.com/Motues/Momo-Backend)
* **丰富的Markdown语法**：支持 Katex，Typst，Alert 组件，Github 卡片，自定义语法等
* 其他基本功能：文章分类，目录，RSS订阅，文字统计，阅读时间

## 🚀 快速开始

1. 克隆本项目
    ```bash
    git clone https://github.com/Motues/Momo.git
    cd Momo
    ```
2. 运行 `pnpm install` 安装依赖（使用 `npm install -g pnpm` 安装 `pnpm`）
3. 运行 `pnpm dev` 启动开发服务器

## 🔧 配置

参考[配置指南](./doc/config_zh-cn.md)，详细信息可以访问 [Momo](https://momo.motues.top/intro/config)，阅读对应文章获取详细信息。

## 📚 更新

参考[更新指南](./doc/release_zh-cn.md)，介绍如何更新项目，详细信息可以访问 [Momo](https://momo.motues.top/intro/release)。

## ⚡ 指令

以下所有的指令可以在根目录下面执行

| 指令 | 作用 |
| --- | --- |
| `pnpm instal` | 安装依赖 |
| `pnpm dev` | 启动本地服务器，运行在 `http://localhost:4321` |
| `pnpm build` | 构建发布版本到 `./dist` 目录下 |
| `pnpm preview` | 预览构建后的发布版本 |
| `pnpm astro ...` | 运行 `astro` 命令，例如 `astro add` |
| `pnpm newpost <path> <lang>` | 创建新文章，例如 `pnpm newpost docs/test.md zh-cn`，语言可以省略，默认为`zh-cn` |


## 📚 参考

* [Astro](https://astro.build/)
* [Fuwari](https://github.com/saicaca/fuwari)
* [Tyndall](https://github.com/moyuin-aka/tyndall-public)