---
title: Article Publishing Guide
pubDate: 2025-09-29
description: Website Configuration
image: ""
draft: false
---

## Creating Article Files

First, create a new Markdown file within the `src/content/blog/` directory. You can create files directly in this directory or organize your articles in subdirectories.

For example, create an article named `src/content/blog/my-first-post.md`, or create `src/content/blog/posts/my-first-post.md` in a subdirectory. Articles will be published to the corresponding route based on the file's relative path (relative to `src/content/`), such as `/blog/my-first-post`.

## Writing Article Metadata

Each article requires a metadata section (frontmatter) formatted in YAML and enclosed by `---`, as shown below:

```yaml
---
title: Article Title
pubDate: 2025-01-01
description: Brief article description
image: ""
draft: false
---
```

| Name | Function | 
| :--- | :--- | 
| `title` | Article title | 
| `pubDate` | Publication date, formatted as `YYYY-MM-DD` |
| `description` | Article description |
| `image` | Cover image, using relative paths relative to the current file, e.g., `./images/cover.png` |
| `draft` | Draft status; articles in draft mode won't appear on the blog homepage when published |

## Writing Article Content

Article content can be written using Markdown format, supporting specific syntax. Refer to other sample articles for details.


## Special Pages

For example, the About page is stored in `src/content/spec/about.md` and written using Markdown. It will be rendered according to Markdown formatting and published to the `/about` route.

Translated with DeepL.com (free version)