# Momo

<div align="center">
    <img src="./images/index-light-en.jpg">
    <p>A minimal blog template build with <a href="https://astro.build/">Astro</a></p>
    <small><a href="../README.md">简体中文</a></small> <small><ins>English</ins></small>
</div>


## ✨ Features

Momo originates from Xiaohongshu📕, serving as the default nickname for every new user—symbolizing a fresh start. This philosophy guides our blog design, striking a balance between complex functionality and minimalist aesthetics.

* **Minimalist Design**: Clean page layout with black and white as primary colors, accented by blue
* **Dark Mode**: Supports manual switching or automatic system adaptation
* **Photo cover**: the first page of the home page can use a full-screen photo as its cover, with the title and subtitle centered and enlarged on top of an adjustable black mask; scrolling down moves the title smoothly back to its place while the photo fades into a faint backdrop, and every other page keeps a very faint copy of it
* **Client-side navigation**: in-site links are handled by [swup](https://swup.js.org/) instead of full page reloads, with hover preloading, fade transitions and "back / forward returns to the same spot"
* **Mobile Adaptation**: Components optimized for mobile devices, delivering the same experience as desktop browsers
* **Image experience**: Click any image to open the lightbox; consecutive images are automatically laid out as a grid; images inside posts support an LQIP gradient placeholder
* **Extensive Markdown syntax**: KaTeX, Typst (compiled to SVG at build time), Alert components, GitHub / NetEase Music cards, quote component, ruby annotations, spoilers, rainbow text, underline, new-tab links, Expressive Code and more
* **Local search**: Localized search built with [pagefind](https://pagefind.app/), no external service required
* **Internationalization (i18n)**: Supports multilingual switching, currently available in Simplified Chinese and English
* **Commenting**: Supports local deployment and Cloudflare deployment. See [Backend](https://github.com/Motues/Momo-Backend) for details; with silent verification enabled on the backend, visitors pass the human check automatically without solving puzzles or typing codes
* **SEO**: canonical URLs, hreflang alternates, Open Graph / Twitter Cards, structured data, `sitemap.xml` and `robots.txt`
* **Local CMS**: Start it with `pnpm cms` to edit posts with live preview (sharing the same Markdown pipeline as the blog) instead of editing Markdown by hand
* **Command line tool**: `pnpm momo` provides config backup/restore, one-command updates, new post creation and environment checks
* Other core features: Article categories, directory, RSS subscription, text statistics, reading time

## 🚀 Quick Start

> Requirements: Node.js **>= 22** (24 LTS recommended; the local CMS needs **>= 22.18**) and [pnpm](https://pnpm.io/)

1. Clone this project
    ```bash
    git clone https://github.com/Motues/Momo.git
    cd Momo
    ```
2. Run `pnpm install` to install dependencies (use `npm install -g pnpm` to install `pnpm`)
3. Run `pnpm dev` to start the development server

## 🔧 Configuration

Refer to the [Configuration Guide](./config_en.md). For detailed information, visit [Momo](https://momo.motues.top/en/intro/config) and read the corresponding articles.

Site information, theme switches, languages and the Cover text of each page are configured in `src/config.ts`; the `site` and `i18n` fields of `astro.config.mjs` read from that file automatically.

## 📚 Updating

Refer to the [Update Guide](./release_en.md) for instructions on updating your project. Visit [Momo](https://momo.motues.top/en/intro/release) for detailed information.

Run `pnpm momo update` to do it automatically: it checks the GitHub releases, downloads the new source, backs up, overwrites the code, deletes files the new version no longer ships and installs dependencies, then lists the config files that need manual merging. Your own posts and images (`src/content`, `src/assets`, `public`) and `src/config.ts` are always kept; deletion only covers files that existed in the previous template but were removed upstream (tracked in `.momo/manifest.json`, so files you added yourself are never touched — add `--no-delete` to keep them and only overwrite). Add `--dry-run` to preview the changes without writing anything. A slow or blocked GitHub needs no extra setup: it probes GitHub and a list of public mirrors in parallel and downloads through the fastest one, switching sources on timeouts or broken archives (`--mirror <prefix>` or `MOMO_MIRROR` pins your own, `--mirror direct` forces a direct connection).

## 🍃 Branch

Below are some branches that are maintained on an irregular basis; we cannot guarantee that they will remain in sync with the `main` branch.

* `memos`: Implements the Memos card feature
* `v5`: Version v5—no longer supported

## ⚡ Commands

All commands below can be executed in the root directory

| Command | Function |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start local server at `http://localhost:4321` |
| `pnpm build` | Build release version to `./dist` (including the pagefind search index) |
| `pnpm preview` | Preview built release version |
| `pnpm astro ...` | Run `astro` commands, e.g., `astro add` |
| `pnpm cms` | Start the local CMS at `http://localhost:5188` (run `pnpm install` first) |
| `pnpm momo new [path]` | Create a new post; the path defaults to a date based one, e.g. `pnpm momo new docs/test` |
| `pnpm momo backup` | Back up `src/config.ts` to `.backup/` (add `--config` for every config file, `--all` to also include posts and images) |
| `pnpm momo restore [name]` | Restore from a backup (the latest one by default) |
| `pnpm momo update` | Update the template code from the [GitHub releases](https://github.com/Motues/Momo/releases) and sync dependencies (keeps your own posts and images, deletes files dropped by the new version; `--dry-run` previews the changes, `--no-delete` only overwrites, `--mirror` picks the download source) |
| `pnpm momo clean` | Remove build output and caches (add `--all` to also remove `node_modules`) |
| `pnpm momo doctor` | Check the environment, dependencies and project status |
| `pnpm momo --help` | Show every momo command and option |


## 📚 References

* [Astro](https://astro.build/)
* [Fuwari](https://github.com/saicaca/fuwari)
* [Tyndall](https://github.com/moyuin-aka/tyndall-public)
