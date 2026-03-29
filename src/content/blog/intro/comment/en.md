---
title: Deploying a Comment System
pubDate: 2026-01-08
description: Website Configuration
category: Instruction
image: ""
draft: false
slugId: momo/intro/comment
---

Momo supports adding comment functionality and offers two deployment methods, including serverless deployment. For details, visit the repository [Momo-backend](https://github.com/Motues/Momo-Backend).

::github{repo="Motues/Momo-Backend"}

## Configuration

To enable comments, first deploy the backend comment system as detailed in the Momo-backend repository.

After deployment, set `comments.enable` to `true` in `src/config.ts` and specify `comments.backendUrl` with the backend URL to activate comments.

## Operation

The comment component is written in Svelte. Similar to most comment systems, users must enter a nickname and email address (for notifications) to post comments. They may optionally provide a website URL.

## Custom Frontend

If you need to use the comment feature in other projects, you can directly import it via CDN. The usage method is as follows. For details, please refer to the repository [Momo-backend](https://github.com/Motues/Momo-Backend).

```html
<div id="momo-comment"></div>
<script src="https://cdn.jsdelivr.net/npm/@motues/momo-comment/dist/momo-comment.min.js"></script>
<script>
    momo.init({
        el: '#momo-comment', // Comment container ID
        title: 'Test', // Article title
        slugId: 'blog/test', // Unique slugId of the article
        lang: 'zh-cn', // Language, currently supports zh-cn, en
        apiUrl: 'https://api-momo.motues.top' // Backend address
    });
</script>
```

> We recommend using version numbers to lock the version to avoid conflicts caused by updates.

The comment system also provides a backend management interface supporting comment moderation and deletion.

## Custom Styles

Currently, you can modify the colors of the comment component; custom style features will be released in the future. Colors are modified by setting global variables, and dark mode is supported.

```css
:root {
    --momo-text-color: #d51111;            /* Text color */
    --momo-button-border-color: #e5e5e5;   /* Button border color */
    --momo-button-hover-bg-color: #f5f5f5; /* Button background color (hover state) */
    --momo-link-color: #003b6e;            /* Link color */
}
/* Dark mode */
[data-theme=“dark”] { 
    - -momo-text-color: #3ad8d8;
    --momo-button-border-color: #2e2e2e;
    --momo-button-hover-bg-color: #3c3c3c;
    --momo-link-color: #fff;
}
```
