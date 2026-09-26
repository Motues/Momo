# Momo Configuration Guide

## Configuration files at a glance

| File | Purpose |
| --- | --- |
| `src/config.ts` | **Main entry point**: site information, theme switches, profile, license, friend links, languages and the Cover text of every page |
| `src/content.config.ts` | Schema of the article frontmatter (only needs changes when fields are added or modified) |
| `src/i18n/` | UI translations (everything except the Cover text) |
| `src/types/` | TypeScript types for the configuration above |

## `src/config.ts`

### `siteConfig`

* `title`: Site title
* `subTitle`: Site subtitle; **when left empty, the browser tab title (and the RSS title) shows `title` only**, without a dangling ` - ` separator
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
    * `LQIP`: Enable LQIP (low-quality image placeholder)
    * `PhotoSwipe`: Enable PhotoSwipe
    * `imageCollage.enable`: Enable automatic image collage (consecutive images in the content are arranged into a grid)
    * `imageCollage.maxColumns`: Max images per row in a collage (2 - 6, default 4); the actual number per row is chosen automatically from the image count, and the images of the last row always fill the whole row
    * `postCard.imageMode`: Cover style of the article cards on the home page, `top` puts the image above the content, `background` uses it as the card background
* `expressiveCode`
    * `enable`: Enable [Expressive Code](https://expressive-code.com/) 
    * `theme`: Shiki theme name of code blocks, e.g. `one-dark-pro` (default), `github-dark`, `vitesse-dark`; the same theme is used in light and dark mode

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

## Internationalization (i18n)

The i18n files live in `src/i18n/`:

* `key.ts`: the `Translation` interface, the single source of truth for the translation structure
* `language/zh-cn.ts`, `language/en.ts`: UI copy for each language; fields must match `Translation` one to one
* `translation.ts`: `i18nit(lang)` returns a `t(key, params)` function with `{name}` style parameter substitution and a fallback to the default language

**The Cover text of each page (`cover.title` / `cover.subTitle`) has moved into `i18nConfig.translations` in `src/config.ts`.** The files under `src/i18n/language/` simply reference it, so to change the title or subtitle of the home, archive, about or friends page, edit `src/config.ts` instead of the language files.
