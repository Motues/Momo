---
title: 文章发布指南
pubDate: 2025-09-29
description: 网站配置
image: ""
draft: false
slugId: momo/intro/publish
---


## 创建文章文件

首先，在 `src/content/blog/` 目录下创建一个新的文件夹。您可以直接在该目录下创建，也可以在子目录中创建新的文件夹。

例如，创建一篇名为 `src/content/blog/my-first-post/` 的文件夹，或在子目录中创建`src/content/blog/posts/my-first-post/`；编写的文章最后会根据文件的相对路径（相对于 `src/content/`）发布到对应的路由上，比如`/blog/my-first-post`。

为了使用国际化，对于不同语言的文章，请使用 `<language>.md` 问价进行区分，比如`src/content/blog/my-first-post/zh-cn.md`和`src/content/blog/my-first-post/en.md`，分别表示一篇文章的中文和英文版本。

:::important
* 一定要存在默认的语言版本，在生成页面时，如果当前文章缺少对于语言版本，则使用默认语言版本作为文章内容。
* 所使用的语言需要在`astro.config.mjs`中配置。
:::

## 编写文章元数据

每篇文章都需要包含元数据部分（frontmatter），使用 YAML 格式，用 `---` 包围，如下所示：

```yaml
---
title: 文章标题
pubDate: 2025-01-01
description: 文章简短描述
image: ""
draft: false
slugId: intro/publish
---
```

| 名称 | 作用 | 
| :--- | :--- | 
| `title` | 文章标题 | 
| `pubDate` | 发布时间，格式为 `YYYY-MM-DD` |
| `description` | 文章描述 |
| `image` | 封面图片，使用相对路径，相对于当前文件，比如`./images/cover.png` |
| `draft` | 是否草稿，当文章处于草稿状态，发布的时候将不会显示在博客主页 |
| `slugId` | 文章的ID，用于生成路由，每篇文章必须是唯一的，建议使用文章路径，比如`intro/publish` |

## 编写文章内容

文章内容可以使用 Markdown 格式编写，支持一些特殊语法，具体可以参考其他测试文章。


## 特殊页面

比如介绍页面，保存在 `src/content/spec/about/`文件夹中，和文章的内容类似，支持多种语言，并使用Markdown进行编写，最后会按照Markdown的格式进行渲染，发布到`/about`路由上。