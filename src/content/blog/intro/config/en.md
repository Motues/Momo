---
title: Momo Configuration Guide
pubDate: 2025-09-28
description: Website Configuration
category: Instruction
image: ""
draft: false
slugId: momo/intro/config
---

## Configuration files at a glance

| File | Purpose |
| --- | --- |
| `src/config.ts` | **Main entry point**: site information, theme switches, profile, license, friend links, languages and the Cover text of every page |
| `src/content.config.ts` | Schema of the article frontmatter (only needs changes when fields are added or modified) |
| `src/i18n/` | UI translations (everything except the Cover text) |

## `src/config.ts`

### `siteConfig`

* `title`: Site title
* `subTitle`: Site subtitle
* `rootSiteUrl`: Root URL of the site, used to generate absolute links for SEO and social sharing; `astro.config.mjs` uses it as `site`
* `favicon`: Site icon
* `pageSize`: Number of articles per page
* `toc`
    * `enable`: Enable table of contents
    * `depth`: Table of contents depth
* `blogNavi`
    * `enable`: Enable page navigation at the bottom of the blog
* `comments`
    * `enable`: Enable comment feature
    * `platform`: Comment platform, `default` uses Momo-backend, `twikoo` is also supported
    * `backendUrl`: Url of the backend
* `theme`
    * `AOS`: Enable AOS animations
    * `LQIP`: Enable LQIP
    * `PhotoSwipe`: Enable PhotoSwipe
    * `postCard`
        * `imageMode`: Cover image mode for article cards
            * `"top"`: The image is displayed above the card content (default)
            * `"background"`: The image is used as the card background, fading to transparent from right to left
* `expressiveCode`
    * `enable`: Enable the Expressive Code code block enhancements; when disabled, code blocks fall back to plain text (identical on the blog and in the CMS preview)
    * `theme`: Shiki theme name of code blocks, e.g. `"one-dark-pro"` (default), `"github-dark"`, `"vitesse-dark"`; the same theme is used in light and dark mode

:::tip
For the backend project, refer to [Momo-backend](https://github.com/Motues/Momo-Backend). Ensure all configurations are completed as specified, particularly for cross-domain domains.
:::

### `profileConfig`

* `avatar`: Profile picture, relative to the `src/` directory; relative to `public/` when it starts with `/`
* `name`: Name, shown in the footer
* `description`: Description, used in SEO
* `indexPage`: Profile homepage, shown in the footer
* `startYear`: Year the site was created, used for the copyright year range in the footer

### `licenseConfig`

* `enable`: Enable license display at the end of articles
* `name`: License name
* `url`: License URL

### `friendLinkConfig`

* `name`: Friend link name
* `avatar`: Friend link icon
* `url`: Friend link URL
* `description`: Friend link description, set to an empty string if not needed

### `i18nConfig`

* `defaultLanguage`: Default language, also used as `defaultLocale` in `astro.config.mjs` (the default language is not prefixed in URLs)
* `supportedLanguages`: List of supported languages, also used as `locales` in `astro.config.mjs`
* `translations`: **Cover text** for each language
    * `translations["zh-cn"].Cover` / `translations["en"].Cover`
    * `Cover.title`: Large title of each page — `home`, `archive`, `about`, `friends`
    * `Cover.subTitle`: Subtitle of each page, same keys as above; `archive` supports the `{count}` placeholder, which is replaced with the total number of articles

## Internationalization Configuration

The i18n files live in the `src/i18n/` folder:

* `key.ts`: the `Translation` interface, the single source of truth for the translation structure
* `language/zh-cn.ts`, `language/en.ts`: UI copy for each language; fields must match `Translation` one to one
* `translation.ts`: `i18nit(lang)` returns a `t(key, params)` function with `{name}` style parameter substitution and a fallback to the default language

The Cover text of each page (`cover.title` / `cover.subTitle`) has moved into `i18nConfig.translations` in `src/config.ts`, and the files under `src/i18n/language` simply reference it. To change the title or subtitle of the home, archive, about or friends page, edit `src/config.ts` instead of the language files.
