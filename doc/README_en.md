# Momo

<div align="center">
    <img src="./images/index-light-en.jpg">
    <p>A nimimal blog template build with <a href="https://astro.build/">Astro</a></p>
    <small><a href="../README.md">简体中文</a></small> <small><ins>English</ins></small>
</div>


## ✨ Features

* Minimalist design
* Supports dark mode switching and automatically follows system settings
* Supports article search functionality (pagefind)
* Internationalization (i18n)

## 💻 Environment Requirements

* Node.js (recommended version above 20.x)
* pnpm (install using `npm install -g pnpm`)

## 🚀 Quick Start

1. Clone this project
    ```bash
    git clone https://github.com/Motues/Momo.git
    cd Momo
    ```
2. Run `pnpm install` to install dependencies
3. Run `pnpm dev` to start the development server

## 🔧 Configuration

Refer to the [Configuration Guide](./config_en.md), detailed information can be found at [Momo](https://momo.motues.top/).

## ⚡ Commands

All commands below can be executed in the root directory

| Command | Function |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start local server at `http://localhost:4321` |
| `pnpm build` | Build release version to `./dist` directory |
| `pnpm preview` | Preview built release version |
| `pnpm astro ...` | Run `astro` commands, e.g., `astro add` |
| `pnpm new <path> <lang>` | Create a new article, e.g., `pnpm new docs/test.md zh-cn`, the language can be omitted, defaulting to `zh-cn` |

## 📜 TODO

- [x] Add friend links feature
- [x] Add memo feature
- [x] Add search functionality (using pagefind, requires handling Chinese matching)
- [ ] Optimize Markdown styles, e.g., ~~formulas~~, code blocks, ~~special prompts~~
- [x] Implement article pagination
- [x] Add table of contents
- [x] Add RSS feed
- [x] Support categories
- [ ] Other minor features, e.g., ~~back to top~~, ~~estimated reading time~~
- [x] Support comment（serverless deployment, [Backend](https://github.com/Motues/Momo-Backend)）
- [x] Internationalization (i18n)

## 📚 References

* [Astro](https://astro.build/)
* [Fuwari](https://github.com/saicaca/fuwari)
* [Tyndall](https://github.com/moyuin-aka/tyndall-public)