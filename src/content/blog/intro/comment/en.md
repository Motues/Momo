---
title: Deploying a Comment System
pubDate: 2026-01-08
description: Website Configuration
image: ""
draft: false
slugId: momo/intro/comment
---

Momo supports adding comment functionality and offers two deployment methods, including serverless deployment. For details, visit the repository [Momo-backend](https://github.com/Motues/Momo-Backend).

## Configuration

To enable comments, first deploy the backend comment system as detailed in the Momo-backend repository.

After deployment, set `comments.enable` to `true` in `src/config.ts` and specify `comments.backendUrl` with the backend URL to activate comments.

## Operation

The comment component is written in Svelte. Similar to most comment systems, users must enter a nickname and email address (for notifications) to post comments. They may optionally provide a website URL.

The comment system also provides a backend management interface supporting comment moderation and deletion.
