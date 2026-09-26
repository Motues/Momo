---
title: Update Guide and Release
pubDate: 2026-01-01
description: Website Configuration
category: Instruction
image: "./images/banner.png"
draft: false
slugId: momo/intro/release
pinTop: 1
---

This project is currently under active maintenance. To update, follow these steps:

First, verify the version number in `package.json` or review the changelog here or at [Release](https://github.com/Motues/Momo/releases).

The project version number is only incremented when the configuration file structure undergoes structural changes. Project configuration files refer to those related to website layout and content, including `astro.config.mjs`, `src/config.ts`, `src/content.config.ts`, and files within the `src/i18n/` folder.

Blog text, images, and other content are stored in the `src/content/`, `src/assets`, and `public` folders.

## Version Number Unchanged

You can directly clone this project, then overwrite the new project with your original configuration files. Run `pnpm install` to install dependencies, followed by `pnpm build` for local compilation. Finally, execute `pnpm preview` to preview the compiled project.

When updating inside this repository, run `pnpm momo update`: it reads the latest [release](https://github.com/Motues/Momo/releases), compares it with the version in `package.json`, downloads that version's source, **keeps your own posts and images** (`src/content`, `src/assets`, `public`) and `src/config.ts`, overwrites the rest of the code and installs dependencies, then lists the **configuration files that need to be merged by hand**. Run `pnpm momo update --dry-run` first to preview the changes; overwritten files are saved under `.backup/update-<timestamp>/overwritten/`, and `pnpm momo restore <backup name>` rolls the configuration back.

## Version Number Changed

Whenever the version number changes, the modification log will be updated here. Refer to the specific log entries to modify the corresponding configuration files.

Below are general modification suggestions.

* **`astro.config.mjs` Modifications**: Typically just overwrite the file. Its `site` and `i18n` fields are read from `siteConfig.rootSiteUrl`, `i18nConfig.defaultLanguage` and `i18nConfig.supportedLanguages` in `src/config.ts`.
* **`config.ts` Modifications**: Update `config.ts` by adding or modifying configuration items as required.
* **`content.config.ts` Modifications**: Typically involves adding new frontmatter configurations to articles. Add the required new configuration items to articles as specified.
* **`src/i18n/` Modifications**: Generally involves adding new internationalization translations; simply overwrite the files. Note that the Cover text of each page (`cover.title` / `cover.subTitle`) has moved into `i18nConfig.translations` in `src/config.ts` — edit it there.

## Version Information

> Version numbers follow the `YY.MM.DD` format

### 26.9.26

* New **automatic image collage**: consecutive images in the content are laid out as a grid and still open full size in the lightbox
* `pnpm momo update` is now **release-based**: it no longer depends on local git and keeps your own posts, images and `src/config.ts`
* Front-end smoothness work: reduced the home page's blocking stylesheet and fixed the listener pile-up and the entrance animation dying after a client-side navigation
* New `pnpm momo audit` command for re-measuring the first-paint cost of a build
* The CMS "Site config" page gained the collage switch and the per-row limit
* This update modifies the `src/config.ts` configuration file by adding the `theme.imageCollage` field; you must add this new field when updating, while every other file can simply be overwritten

### 26.9.25

* Code blocks switched to the official **Expressive Code** integration, with title bars, line highlighting, diff markers, line numbers, collapsible sections and a copy button; the switch and code theme live in `siteConfig.expressiveCode` in `src/config.ts`
* The image lightbox is now self-built (no longer depending on `photoswipe`): wheel / button / double-click / pinch zoom, drag to pan, arrow keys or swipe to switch, Esc to close, with fly-in and fly-out animations
* The CMS gained a "Site config" page (`#/config`) for editing `src/config.ts` visually; the archive page is now server-rendered
* SEO improvements: canonical, hreflang, Open Graph / Twitter Cards, structured data, `sitemap.xml` and `robots.txt`
* This update modifies the `astro.config.mjs` configuration file, adds the new config file `ec.config.mjs` and adds `siteConfig.expressiveCode` to `src/config.ts`; it also changes the dependencies (adds `astro-expressive-code`, removes `photoswipe`), so add the new fields and run `pnpm install` when updating

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
* Added support for a new Markdown style: ++the underscore syntax++
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
