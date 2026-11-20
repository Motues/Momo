## Heading levels

### Third-level heading

Body copy uses the site serif (Source Serif) at 1.75 line-height. This paragraph is long enough to show the rhythm of Latin text: **bold**, *italic*, `inline code` and an [internal link](/en/about/) all share one line.

> Blockquotes use WenKai (LXGW Bright) with a soft rule on the left and a lighter text color.

Unordered list:

- First item: 0.3rem between list items
- Second item: with a little `inline` detail
  - Nested items keep the parent font size

Ordered list:

1. Step one: reach for a `--momo-*` token
2. Step two: then write the component style

```ts title="tokens.ts" {3}
export function readToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
```

| Layer | Location | Example |
| --- | --- | --- |
| Token | `variables.css` | `--momo-radius-lg` |
| Base | `global.css` | `body` / `::selection` |
| Component | `components.css` | `.momo-card` |
| Feature | page / component styles | `.ds-swatch` |

![Sample cover](/cover.jpg "Caption: images use the 8px radius; captions sit centered and one size smaller")
