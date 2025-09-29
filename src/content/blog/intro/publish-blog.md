---
title: 文章发布指南
pubDate: 2025-09-29
description: 网站配置
image: ""
draft: false
---


## 创建文章文件

首先，在 `src/content/blog/` 目录下创建一个新的 Markdown 文件。您可以直接在该目录下创建文件，也可以在子目录中组织您的文章。

例如，创建一篇名为 `src/content/blog/my-first-post.md` 的文章，或在子目录中创建`src/content/blog/posts/my-first-post.md`；编写的文章最后会根据文件的相对路径（相对于 `src/content/`）发布到对应的路由上，比如`/blog/my-first-post`。

## 编写文章元数据

每篇文章都需要包含元数据部分（frontmatter），使用 YAML 格式，用 `---` 包围，如下所示：

```yaml
---
title: 文章标题
pubDate: 2025-01-01
description: 文章简短描述
image: ""
draft: false
---
```

| 名称 | 作用 | 
| :--- | :--- | 
| `title` | 文章标题 | 
| `pubDate` | 发布时间，格式为 `YYYY-MM-DD` |
| `description` | 文章描述 |
| `image` | 封面图片，使用相对路径，相对于当前文件，比如`./images/cover.png` |
| `draft` | 是否草稿，当文章处于草稿状态，发布的时候将不会显示在博客主页 |

## 编写文章内容

文章内容可以使用 Markdown 格式编写，支持一些特殊语法，具体可以参考其他测试文章。


## 特殊页面

比如介绍页面，保存在 `src/content/spec/about.md` ，并使用Markdown进行编写，最后会按照Markdown的格式进行渲染，发布到`/about`路由上。