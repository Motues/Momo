---
title: Momo Configuration Guide
pubDate: 2025-09-28
description: Website Configuration
image: ""
draft: false
slugId: momo/intro/config
---

## Website Information Configuration

The primary configuration files for the website are `astro.config.mjs` and `src/config.ts`

### `astro.config.mjs`

* `site`: Website URL
* `i18n`: Internationalization configuration
    * `locale`: Supported languages
    * `defaultLocale`: Default language
* `markdown`
    * `shikiConfig`: Code block styling. Refer to Astro's documentation [Shiki](https://docs.astro.build/en/guides/syntax-highlighting/#setting-a-default-shiki-theme)

### `src/config.ts`

#### `siteConfig`

* `title`: Site title
* `subTitle`: Site subtitle
* `favicon`: Site icon
* `pageSize`: Number of articles per page
* `toc`
    * `enable`: Enable table of contents
    * `depth`: Table of contents depth
* `comments`
    * `enable`: Enable comment feature
    * `backendUrl`： Url of the backend

:::tip
For the backend project, refer to [Momo-backend](https://github.com/Motues/Momo-Backend). Ensure all configurations are completed as specified, particularly for cross-domain domains.
:::

#### `profileConfig`

* `avatar`: Profile picture
* `name`: Name
* `description`: Description
* `indexpage`: Profile homepage

#### `licenseConfig`

* `enable`: Enable license display at the end of articles
* `name`: License name
* `url`: License URL

#### `friendLinkConfig`

* `name`: Friend link name
* `avatar`: Friend link icon
* `url`: Friend link URL
* `description`: Friend link description

## Internationalization Configuration

Internationalization configuration files are located in the `src/i18n/` folder.

To modify the cover content for the homepage or other pages, edit the corresponding files within the `src/i18n/language` folder. Simply modify the `cover.title` and `cover.subtitle` fields as needed.