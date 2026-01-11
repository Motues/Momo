---
title: Article Publishing Guide
pubDate: 2025-09-29
description: Website Configuration
image: ""
draft: false
slugId: momo/intro/publish
---

## Creating Article Files

First, create a new folder under the `src/content/blog/` directory. You can create it directly within this directory or nest it within subdirectories.

For example, create a folder named `src/content/blog/my-first-post/`, or create `src/content/blog/posts/my-first-post/` within a subdirectory. Your article will be published to the corresponding route based on the file's relative path (relative to `src/content/`), such as `/blog/my-first-post`.

For internationalization, use `<language>.md` naming conventions to distinguish articles in different languages. For example, `src/content/blog/my-first-post/zh-cn.md` and `src/content/blog/my-first-post/en.md` represent the Chinese and English versions of an article, respectively.

:::important
* A default language version must exist. When generating pages, if a language version is missing for the current article, the default language version will be used as the article content.
* The languages used must be configured in `astro.config.mjs`.
:::

## Writing Article Metadata

Each article requires a metadata section (frontmatter) using YAML format, enclosed by `---` as shown below:

```yaml
---
title: Article Title
pubDate: 2025-01-01
description: Brief article description
image: ""
draft: false
slugId: intro/publish
---
```

| Name | Function | 
| :--- | :--- | 
| `title` | Article title | 
| `pubDate` | Publication date, formatted as `YYYY-MM-DD` |
| `description` | Article description |
| `image` | Cover image, using relative paths relative to the current file, e.g., `./images/cover.png` |
| `draft` | Draft status; articles in draft mode won't appear on the blog homepage when published |
| `slugId` | Article ID, used for generating routes. Each article must be unique. It is recommended to use article paths, such as `intro/publish`. |

## Writing Article Content

Article content can be written using Markdown format, supporting specific syntax. Refer to other sample articles for details.

## Special Pages

For example, the About page is stored in the `src/content/spec/about/` folder. Similar to articles, it supports multiple languages and is written in Markdown. It will be rendered according to Markdown formatting and published to the `/about` route.