---
title: Update Guide and Release
pubDate: '2026-01-01'
description: Website Configuration
category: Instruction
image: ./images/banner.png
draft: false
slugId: momo/intro/release
pinTop: 1
---

This project is currently under active maintenance. To update, follow these steps:

First, verify the version number in `package.json` or review the changelog here or at [Release](https://github.com/Motues/Momo/releases).

The project version number is only incremented when the configuration file structure undergoes structural changes. Project configuration files refer to those related to website layout and content, including `astro.config.mjs`, `src/config.ts`, `src/content.config.ts`, and files within the `src/i18n/` folder.

Blog text, images, and other content are stored in the `src/content/`, `src/assets`, and `public` folders.

## Update with scripts

You can directly clone this project, then overwrite the new project with your original configuration files. Run `pnpm install` to install dependencies, followed by `pnpm build` for local compilation. Finally, execute `pnpm preview` to preview the compiled project.

When updating inside this repository, run `pnpm momo update`: it reads the latest [release](https://github.com/Motues/Momo/releases), compares it with the version in `package.json`, downloads that version's source, **keeps your own posts and images** (`src/content`, `src/assets`, `public`) and `src/config.ts`, overwrites the rest of the code, **deletes files the new version no longer ships** and installs dependencies, then lists the **configuration files that need to be merged by hand**. 

## Version Number Changed

Whenever the version number changes, the modification log will be updated here. Refer to the specific log entries to modify the corresponding configuration files.

Below are general modification suggestions.

* **`astro.config.mjs` Modifications**: Typically just overwrite the file. Its `site` and `i18n` fields are read from `siteConfig.rootSiteUrl`, `i18nConfig.defaultLanguage` and `i18nConfig.supportedLanguages` in `src/config.ts`.
* **`config.ts` Modifications**: Update `config.ts` by adding or modifying configuration items as required.
* **`content.config.ts` Modifications**: Typically involves adding new frontmatter configurations to articles. Add the required new configuration items to articles as specified.
* **`src/i18n/` Modifications**: Generally involves adding new internationalization translations; simply overwrite the files. Note that the Cover text of each page (`cover.title` / `cover.subTitle`) has moved into `i18nConfig.translations` in `src/config.ts` — edit it there.

## Version Information

> Version numbers follow the `YY.MM.DD` format

### 26.10.10

* **Upgraded silent comment verification**: the quiet human check now uses a HashWX (WebAssembly) proof of work solved in parallel, plus a new "environment challenge" that runs a small random program, so it finishes faster and is much harder to fake; visitors still pass it without solving puzzles or typing codes. **The comment backend must be upgraded as well** ([Momo-Backend](https://github.com/Motues/Momo-Backend)) — an outdated backend is reported in the comment area instead of leaving people waiting
* **Clearer verification failures**: "your browser is too old to complete verification" and "the verification service is outdated, please ask the site owner to upgrade" are now told apart, instead of a generic failure that invites pointless retries
* **The local CMS config page gained a floating table of contents**: the sections are listed along the right edge, clicking one scrolls smoothly to it and the current section highlights as you scroll; it can be collapsed at any time and starts collapsed in narrow windows, and "Theme and effects" is grouped by topic so you no longer scroll through everything
* **Every CMS dropdown is now a custom component**: it matches the site's look, is no longer clipped or covered by toolbars and dialogs, flips upwards near the bottom of the screen, and works with both the keyboard (↑↓ / Home / End / Enter / Esc / first-letter jump) and touch
* **The CMS editor autosaves**: every 60 seconds it saves a changed post and shows "autosaved HH:MM" in the top bar — no dialogs and no editor rebuild, so the cursor and undo history stay put
* **Fixes**: closing the image lightbox no longer blinks away — when its thumbnail has scrolled out of view it now flies back in that direction, and focusing the close button no longer nudges the page; the search modal locks page scrolling while it is open, so the wheel no longer leaks through to the page behind
* This update modifies the config files `src/i18n/` (new comment translations `comments.verifyUnsupported` / `comments.verifyBackendOutdated`) — merge them as prompted. The bundled HashWX component is distributed under LGPL-3.0; see the new `THIRD_PARTY_NOTICES.md` for its origin and licence

### 26.10.8

* **Comments support silent verification**: once the backend turns it on, visitors pass the human check quietly in the background — no puzzles to solve, no codes to type — and then submit as usual. The check runs in batches so the input box and page scrolling stay smooth. Whether it is enabled is decided by the comment backend, so there is nothing to configure on the front end; with it off, the comment area behaves exactly as before
* **A sturdier, safer comment area**: author website links now only allow the `http` / `https` / `mailto` protocols, so `javascript:` links in older data are no longer rendered as clickable addresses; previews and content are sanitized with DOMPurify; when the browser blocks site storage (incognito / private mode) it no longer throws and interrupts, and drafts and input keep working; after submitting a comment the list refreshes silently instead of being replaced by "Loading comments..."
* **`pnpm momo update` picks the fastest download source automatically**: it probes the direct GitHub connection and public mirrors in parallel and uses whichever measures faster, switching sources on timeouts or broken archives, so a blocked GitHub needs no extra setup; the new `--mirror <prefix>` option or the `MOMO_MIRROR` environment variable pins your own, `--mirror direct` forces a direct connection, and downloads show a single-line progress
* **Reworked blue**: the light-mode link colour moves from a near-black navy to a bright theme blue, so a title finally looks different on hover; "blue as a background under text" and "blue as link text" are now two separate colours, lifting dark-mode white-on-blue from 2.48:1 to 7.22:1 (the 404 button and the selected category chips on the archive page and in the mobile drawer), and the footnote jump highlight became a light blue wash instead of putting text on top of its own colour
* **Clearer header glass**: the desktop navigation pill's background drops from 65% to 15% solidity, becoming almost colourless glass (outline, shadow and blur unchanged)
* **Reworked home page scroll arrow**: the circle outline and background are gone, leaving a larger arrow that breathes slowly, and hovering enlarges it with a soft white glow
* **Fixes**: closing the image lightbox now flies back to the thumbnail you are currently viewing (it used to fly to the one you clicked when opening, if you had switched images); the code block copy button no longer stays enlarged on phones and touch devices, back to the desktop size; the floating menu's frosted glass no longer waits for the pop-out animation to finish before appearing
* This update modifies the config files `src/i18n/` (new comment translations `comments.verifying` / `verifySuccess` / `verifyFailed` / `verifyRetry` / `adminKey` / `adminKeyPlaceholder`), and both READMEs were updated accordingly — merge them as prompted

### 26.10.1

> Happy National Day!

* **New photo cover**: the first page of the home page uses a full-screen photo as its background, with the `Cover` title and subtitle centered and enlarged on top of an adjustable black mask; scrolling down smoothly moves the title back to its place, restores its size and colour, and fades the photo into a faint backdrop. Later pagination pages plus the archive / about / friends and post pages all get a very faint version of the photo as their background, and its blurred placeholder is generated at build time — nothing to prepare by hand
* **In-site navigation no longer reloads the page**: [swup](https://swup.js.org/) now handles client-side routing with the same fade as before, plus hover preloading and "back / forward returns to the same spot"; the header / footer / search modal are no longer rebuilt on navigation, and the language menu and active nav state follow the current address
* **The page scrollbar is now [OverlayScrollbars](https://kingsora.github.io/OverlayScrollbars/)**: it floats above the content, hides itself automatically, supports dragging the handle and clicking the track, and follows the theme in both light and dark mode; the search result list uses it too
* **Reworked desktop navigation pill**: nothing but text and the active-page highlight at the top, growing an outline and frosted glass once it docks; with the photo cover it now transitions along the scroll progress instead of switching the moment you scroll
* **The mobile drawer now highlights the current page and filters by category**: the current page gets a background and the accent colour, and the category chips filter the archive page — clicking the selected one again clears the filter
* **Improved link styling in posts**: thinner underlines that sit slightly higher and turn theme blue together with the text on hover; the arrow icon of new-tab links is smaller and changes colour along with the link
* **New config**: `siteConfig.theme.photoCover` (switch / photo path / mask) and `siteConfig.theme.overlayScrollbars` (switch / auto-hide / thickness), editable in `src/config.ts` or in the CMS; new translation `button.scrollDown`
* **CLI**: `pnpm momo update` now also removes files that no longer exist in the new version (add `--no-delete` to only overwrite), `pnpm momo clean` also clears `node_modules/.astro`, and `pnpm momo doctor` flags a leftover `<ClientRouter />`
* A batch of bugs that only surfaced with client-side routing are fixed: broken browser back, the header font flashing after a navigation, out-of-sync TOC and header highlighting, console warnings, and more
* This update modifies the config files `astro.config.mjs` (client-side navigation now uses swup), `src/config.ts` (two new theme switches) and `src/i18n/` (a new `button.scrollDown` translation) — merge them as prompted

### 26.9.29

* New **new-tab link syntax**: put `{target="_blank"}` straight after a link to open it in a new tab, with an arrow icon appended after the link; only `target` / `rel` / `class` are recognised, `rel` always keeps `noopener` / `noreferrer`, and links holding only an image get no icon
* **Reworked content link styling**: links now carry a thin solid underline and turn theme-blue with slight transparency on hover, and the link colour follows its container (so syntax with a colour of its own, such as blockquotes or rainbow text, wins)
* **Image lightbox zoom improvements**: the lightbox opens at 86% on desktop (100% on mobile) and double-click / image switching / the "default scale" button all return to that baseline; fly-in and fly-out use the unscaled, untranslated rect so the animation starts exactly on the thumbnail, and switching images while zoomed no longer jumps back to the default scale first
* Every remark / rehype plugin under `src/plugins/` **moved from `.mjs` to `.ts`** (proper types, trimmed comments), and relative imports between plugins now need an explicit `.ts` extension; the CMS preview loads `.ts` natively in Node, so it needs **Node ≥ 22.18**
* Removed the obsolete `script/newpost.js` and the `pnpm newpost` script (it wrote frontmatter with the long out-of-date `date` / `slug` fields; create posts with `pnpm momo new` or the CMS instead)
* This update modifies the configuration files `astro.config.mjs` (plugin imports use `.ts`) and `package.json` (adds the `@types/hast`, `@types/mdast`, `@types/unist`, `@types/node` and `vfile` dev-dependencies and drops the `newpost` script); overwrite them, run `pnpm install`, and delete the leftover `.mjs` / `.js` files in `src/plugins/`

### 26.9.27

* The collage row height is now **computed per row**: the widest image (largest aspect ratio) decides it and is shown in full, while the other images of the row are cropped to that height
* Collages **no longer show the caption under each image**; the lightbox now reads the image `title` instead
* The collage reads image aspect ratios at build time: relative paths and `/public` paths are read from disk, while remote images are fetched as a header only (512 KB max, 5 s timeout, 6 concurrent); on failure the row height comes from the other images
* The **lightbox can now shrink images down to 50%**, and the matching buttons are disabled at 50% and 800%
* `pnpm momo update` no longer updates `.github`, `.vscode` or `.idea`
* Fixed cover images with an uppercase extension (e.g. `.JPG`) not being found
* This update only changes `astro.config.mjs` (the collage gained the `public` directory lookup), so simply overwrite it

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
