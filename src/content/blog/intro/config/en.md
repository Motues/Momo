---
title: Momo Configuration Guide
pubDate: 2025-09-28
description: Website Configuration
image: ""
draft: false
---

The main configuration files for articles are `astro.config.mjs` and `src/config.ts`

## `astro.config.mjs`

* `site`: Website URL
* `markdown`
    * `shikiConfig`: Code block styling. Refer to Astro's documentation [Shiki](https://docs.astro.build/en/guides/syntax-highlighting/#setting-a-default-shiki-theme)

## `src/config.ts`

### `siteConfig`

* `title`: Site title
* `subTitle`: Site subtitle
* `cover`
    * `enable`: Enable cover
    * `title`: Cover title
    * `subTitle`: Cover subtitle
* `favicon`: Site icon
* `pageSize`: Number of articles per page
* `toc`
    * `enable`: Enable table of contents
    * `depth`: Table of contents depth

### `profileConfig`

* `avatar`: Profile picture
* `name`: Name
* `description`: Description
* `indexpage`: Profile homepage

### `licenseConfig`

* `enable`: Enable license display at the end of articles
* `name`: License name
* `url`: License URL

### `friendLinkConfig`

* `name`: Friend link name
* `avatar`: Friend link icon
* `url`: Friend link URL
* `description`: Friend link description


Translated with DeepL.com (free version)