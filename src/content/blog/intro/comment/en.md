---
title: Deploying a Comment System
pubDate: 2026-01-08
description: Website Configuration
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
        el: ‘#momo-comment’, // Comment container ID
        title: ‘Test’, // Article title
        slugId: ‘blog/test’, // Unique slugId of the article
        lang: ‘zh-cn’, // Language, currently supports zh-cn, en
        apiUrl: ‘https://api-momo.motues.top’ // Backend address
    });
</script>
```

The comment system also provides a backend management interface supporting comment moderation and deletion.
