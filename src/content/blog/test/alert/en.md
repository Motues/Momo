---
title: Test Alert
pubDate: 2025-09-18
description: Article functionality testing
image: ""
draft: true
slugId: momo/test/alert
---

## Alert Component Testing

### Single-Line Content Testing

:::note
This is a note.
:::

:::tip
This is a tip.
:::

:::important
This is an important note.
:::

:::warning
This is a warning.
:::

:::caution
This is a cautionary note.
:::


### Multi-Line Content Testing

:::tip
This is a tip box containing multiple lines of content.

- Supports list items
- Can contain multiple paragraphs

**Key Feature**: Also supports bold text and other Markdown elements.
:::

### Nested Content Testing

:::warning
Tip boxes can contain other elements like code blocks.

```javascript
console.log(‘Hello World’);
```
:::

### Custom Header Test

:::important[Custom Header]
This is a tip box with a custom header. The header displays as "Custom Header" instead of the default “IMPORTANT”.
:::