# Momo

<div align="center">
    <img src="./images/index-light.jpg">
    <p>一个极简的Blog模板，使用 <a href="https://astro.build/">Astro</a> 搭建</p>
    <small><a href="../README.md">English</a></small> <small><ins>简体中文</ins></small>
</div>

## ✨ 特性

* 极简设计
* 支持深色模式切换，并自动跟随系统
* 支持文章搜索功能（pagefind）

## 💻 环境要求

* Node.js （建议版本大于20.x）
* pnpm （使用 `npm -g pnpm` 安装）

## 🚀 快速开始

1. 克隆本项目
    ```bash
    git clone https://github.com/Motues/Momo.git
    cd Momo
    ```
2. 运行 `pnpm install` 安装依赖
3. 运行 `pnpm dev` 启动开发服务器

# 🔧 配置

参考[配置指南](./config_zh-cn.md)

## ⚡ 指令

以下所有的指令可以在根目录下面执行

| 指令 | 作用 |
| --- | --- |
| `pnpm instal` | 安装依赖 |
| `pnpm dev` | 启动本地服务器，运行在 `http://localhost:4321` |
| `pnpm build` | 构建发布版本到 `./dist` 目录下 |
| `pnpm preview` | 预览构建后的发布版本 |
| `pnpm astro ...` | 运行 `astro` 命令，例如 `astro add` |


## 📜 TODO

- [x] 添加友链功能
- [x] 添加备忘录功能
- [x] 添加搜索功能（使用pagefind，还需要处理中文匹配问题）
- [ ] 优化Markdown样式，如~~公式~~，代码块，~~特殊提示~~
- [x] 设置文章分页
- [x] 添加目录
- [x] 添加RSS
- [ ] 其他小功能，比如~~回到顶部~~，预计阅读时间等
- [ ] 完善备忘录页面
- [ ] 国际化（i18n）

## 📚 参考

* [Astro](https://astro.build/)
* [Fuwari](https://github.com/saicaca/fuwari)
