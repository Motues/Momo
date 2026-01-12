---
title: Testing Special Markdown
pubDate: 2026-01-12
description: Article functionality test
image: ""
draft: false
slugId: momo/test/special
---

## Tets Quote

### Normal Quote

:::quote

The universe is a dark forest. Every civilization is an armed hunter stalking through the trees like a ghost, gently pushing aside branches that block the path and trying to tread without sound. Even breathing is done with care. The hunter has to be careful, because everywhere in the forest are stealthy hunters like him. If he finds other life—another hunter, an angel or a demon, a delicate infant or a tottering old man, a fairy or a demigod—there’s only one thing he can do: open fire and eliminate them.

<br><right>——*The Dark Forest*</right>
:::

### Math Quote

:::quote
$E = mc^2$
:::

## Card Testing

### Music Card

::music{id="30431366"}

### Github Card

::github{repo="Motues/Momo"}

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