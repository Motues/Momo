# Update Guide

This project is currently under active maintenance. To update, follow these steps:

First, verify the version number in `package.json` or review the changelog here or at [Release](https://github.com/Motues/Momo/releases).

The project version number is only incremented when the configuration file structure undergoes structural changes. Project configuration files refer to those related to website layout and content, including `astro.config.mjs`, `src/config.ts`, `src/content.config.ts`, and files within the `src/i18n/` folder.

Blog text, images, and other content are stored in the `src/content/`, `src/assets`, and `public` folders.

## Version Number Unchanged

You can directly clone this project, then overwrite the new project with your original configuration files. Run `pnpm install` to install dependencies, followed by `pnpm build` for local compilation. Finally, execute `pnpm preview` to preview the compiled project.

When updating inside this repository, run `pnpm momo update`: it reads the latest [release](https://github.com/Motues/Momo/releases), compares it with the version in `package.json`, downloads the new source, **keeps your own posts and images** (`src/content`, `src/assets`, `public`) and `src/config.ts`, overwrites the rest of the code and installs dependencies, then lists the **configuration files that need to be merged by hand**. Run `pnpm momo update --dry-run` first to preview the changes without writing anything; the files that get overwritten are saved under `.backup/update-<timestamp>/overwritten/`, and `pnpm momo restore <backup name>` rolls the config back.

## Version Number Changed

Whenever the version number changes, the modification log will be updated here. Refer to the specific log entries to modify the corresponding configuration files.

Below are general modification suggestions.

* **`astro.config.mjs` Modifications**: Typically just overwrite the file. Its `site` and `i18n` fields are read from `siteConfig.rootSiteUrl`, `i18nConfig.defaultLanguage` and `i18nConfig.supportedLanguages` in `src/config.ts`.
* **`config.ts` Modifications**: Update `config.ts` by adding or modifying configuration items as required.
* **`content.config.ts` Modifications**: Typically involves adding new frontmatter configurations to articles. Add the required new configuration items to articles as specified.
* **`src/i18n/` Modifications**: Generally involves adding new internationalization translations; simply overwrite the files. Note that the Cover text of each page (`cover.title` / `cover.subTitle`) has moved into `i18nConfig.translations` in `src/config.ts` — edit it there.

## Version Information

> Version numbers follow the `YY.MM.DD` format

### 26.9.27

> Only `astro.config.mjs` changed (the collage gained the `public` directory lookup); simply overwrite it.

* The collage row height is now **computed per row**: the widest image (largest aspect ratio) decides it and is shown in full, while the other images of the row are cropped to that height; a row whose images share one aspect ratio is shown without any cropping
* Collages **no longer show the caption under each image**; the lightbox now reads the image `title` instead
* The collage reads image aspect ratios at build time: relative paths and `/public` paths are read from disk, while **remote images are fetched as a header only** (512 KB max, 5 s timeout, 6 concurrent); on timeout or failure the row height comes from the other images of the row
* The **lightbox can now shrink images down to 50%** (wheel / buttons / pinch; 100% fits the screen), and the matching buttons are disabled at 50% and 800%
* `pnpm momo update` no longer updates `.github`, `.vscode` or `.idea`, so your own repo config stays untouched
* Fixed cover images with an uppercase extension (e.g. `.JPG`) not being found
* Configuration files involved in this update:
    * `astro.config.mjs`: passes `publicDir` to the collage for paths like `/xxx.png`; simply overwrite it

### 26.9.26

> `src/config.ts` is the only file that needs merging by hand; everything else can simply be overwritten. See the notes below.

* New **automatic image collage**: consecutive images are laid out as a grid (2 per row on mobile) and still open full size in the lightbox
* `pnpm momo update` is now **release-based**: it no longer depends on local git, keeps your posts, images and `src/config.ts`, and gains `--check` / `--dry-run` / `--version` / `--keep` / `--keep-config` / `--repo`
* Front-end smoothness work: reduced the home page's blocking stylesheet, enabled Astro prefetch and a persisted header, fixed the listener pile-up and the entrance animation dying after a client-side navigation, and made scrolling rAF-throttled with an always-mounted table of contents, narrowed `transition-all`, a higher-priority LCP cover image, idle Pagefind prefetch and no sideways shift when the mobile drawer locks scrolling
* New `pnpm momo audit` command for re-measuring the first-paint cost of a build
* The CMS "Site config" page gained the collage switch and the per-row limit
* Configuration files involved in this update:
    * `src/config.ts`: `siteConfig.theme` gains `imageCollage` (the collage switch and per-row limit)

### 26.9.25

> This update modifies `astro.config.mjs`, adds the new config file `ec.config.mjs`, and changes dependencies. Please read the notes below.

* Code blocks now use the official **Expressive Code** integration (`astro-expressive-code`): title frames, line highlighting, diff markers, line numbers, collapsible sections, word wrap and terminal frames; the copy button and collapse interaction are provided by Expressive Code itself. The switch and the code theme live in `siteConfig.expressiveCode` of `src/config.ts` (`enable` / `theme`; when disabled, code blocks fall back to plain text), all other options live in the new `ec.config.mjs`, which the CMS live preview shares (same config and renderer)
* The image lightbox is now a built-in implementation (the `photoswipe` package is no longer used): wheel / button / double-click / pinch zoom, drag to pan, arrow keys or swipe to switch, Esc to close, with a smooth fly-in from the thumbnail and a fly-back animation on close
* New CMS "Site config" page (`#/config`): edit `src/config.ts` visually — only the fields you actually changed are rewritten, comments and formatting are preserved. The article editor also gained an "Open folder" button
* SEO improvements: canonical URLs, hreflang alternates, Open Graph / Twitter Cards, WebSite + BlogPosting structured data, `sitemap.xml` and `robots.txt`; the archive page is server-rendered and every page has a single `<h1>`
* When `siteConfig.subTitle` is empty, the browser tab title and RSS title show `title` only
* Configuration files involved in this update:
    * `astro.config.mjs`: adds the `astro-expressive-code` integration (including `getBlockLocale` so code block texts follow the article language, and using `siteConfig.expressiveCode` to decide whether it is enabled and which theme to use) and removes the now ineffective `markdown.shikiConfig`; simply overwrite it
    * `ec.config.mjs` (new): Expressive Code plugins, default props, styles and texts (the code theme is not here, it comes from `src/config.ts`); copy it to your project root
    * `src/config.ts`: adds `siteConfig.expressiveCode` (the `enable` switch and the `theme`, e.g. `"one-dark-pro"`); add it as needed — without it the defaults are used (enabled + `one-dark-pro`)
    * `package.json`: adds `astro-expressive-code`, `@expressive-code/plugin-collapsible-sections` and `@expressive-code/plugin-line-numbers`, removes `photoswipe`
* After updating, clear caches and reinstall dependencies: `pnpm momo clean --all` → `pnpm install` → `pnpm build`

### 26.9.10

> This update contains **breaking configuration changes**. Please read the release notes below carefully!

* Standardized the `config.ts` configuration file to centrally manage the default language, supported languages, and cover text for each page
* Added the command-line tool `pnpm momo`, which supports functions such as backing up, restoring, and updating configurations
* Redesigned the 404 page; made minor adjustments to the spacing between footer icons
* Standardized the naming convention for utility functions
* Updated the CMS admin panel; fixed the issue of slow article information retrieval; added support for column widths to adapt automatically to content in the article list
* This update made changes to the configuration files `src/config.ts`, `src/i18n/language/*.ts`, and `astro.config.mjs`:
    * `src/config.ts`: Added `i18nConfig` and added `rootSiteUrl` to `siteConfig`
    * `src/i18n/language/*.ts`: Removed the original `cover` field; now referenced from `config.ts`
    * `astro.config.mjs`: Updated the `site` and `i18n` sections to reference the configuration in `src/config.ts`
* After the update, you’ll need to clear the local cache (`node_modules`, `.astro`, `dist`) and run `pnpm install` again. You can use `pnpm momo clean --all` to do this quickly

### 26.8.15

> This is a breaking update. Please read the release notes below carefully!

* This update upgrades the project from Astro5 to Astro7. The old version has been archived to the `v5` branch and will no longer be maintained
* Astro7 requires Node.js version >= 22; we recommend using version 24 LTS. After upgrading, you must clear your local cache (folders such as `/node_modules`) before you can compile and preview locally
* This update modifies the configuration files `content.config.ts` and `astro.config.mjs`
* If you encounter any issues after upgrading, please feel free to submit an issue to provide feedback

### 26.8.12

* Home page post cards now support two image display styles and are optimized for mobile devices
* Fixed an issue where the language selection button was hidden in single-language mode
* This update modifies the `config.ts` configuration file by adding the `theme.postCard` field; you must add this new field when updating

### 26.6.2

* The comments component now supports author badges and admin comments, as well as paginated loading of additional comments and collapsible multi-reply threads.
* Added support for footnote styles
* Fixed color flickering issues during page transitions and optimized certain UI elements
* This update modifies the configuration file `src/i18n/`, adding fields such as `comments.verificationRequired`; all other fields remain unchanged. When making modifications, simply add the new fields

### 26.5.6

* Added the `LQIP` low-quality image placeholder feature
* Added support for a new Markdown style: the underscore syntax (++)
* Added style configuration options
* This update modifies the `astro.config.mjs` configuration file to include the `remarkLqip` plugin; it also modifies the `config.ts` configuration file by adding fields such as `theme.LQIP`. When updating, you must add these new fields.


### 26.5.3

* Added a preview feature for comment replies
* Enhanced comment content security
* Fixed a type error in `astro.config.mjs`
* This update modifies the configuration file `astro.config.mjs` by changing how `AdmonitionComponent` is imported; corresponding changes must be made

### 26.4.27

* The comment system now supports Markdown syntax
* This update modifies the configuration file `src/i18n/`, adding fields such as `comments.write`; all other fields remain unchanged. When making modifications, simply add the new fields

### 26.4.21

* Added AOS animation toggle configuration
* The comment system now supports Twikoo
* This update modifies the `config.ts` configuration file by adding the `theme.AOS` and `comments.platform` fields; these new fields must be added when updating

### 26.4.15

* Added the function for pined posts
* Updated the Music Card API URL
* Fixed some styling issues
* This update modifies the `astro.config.mjs` configuration file and adds a new dependency, `@iconify-json/fluent`. You must add the corresponding fields and run `pnpm install`.

### 26.4.7

* Fixed translation errors
* Changed the color of selected text
* Updated the Mucis Card API URL
* This update modifies the configuration file `src/i18n/language/en.ts` by changing the `themeInfo.system` field; all other fields remain unchanged. When updating, you only need to modify the fields that have changed.

### 26.3.29

* Updated the comment data structure to support the new version of the comment backend
* Optimized the styling of comments on mobile devices
* Fixed an issue where the category menu on the archive page was misaligned
* This update modifies the configuration file `src/i18n/` by adding the `comments.replyTo` field; all other fields remain unchanged. To apply the changes, simply add the new field

### 26.3.17

* Changed the style of comment avatars to circular
* Adjusted the margins of some components
* This update modifies the configuration file `src/i18n/` by adding the `themeInfo` field; all other fields remain unchanged. To apply the changes, simply add the new field

### 26.3.11

* Initial release version `26.3.11`
* Multiple project improvements, including: optimized mobile experience, unified website color scheme
* This update modifies the configuration file `src/i18n/`. We recommend using the latest version and updating the `cover.title` and `cover.subtitle` fields with your own information.
