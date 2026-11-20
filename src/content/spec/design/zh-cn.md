## 标题层级

### 三级标题

正文段落使用思源宋体，行高 1.75。这里放一段足够长的文字，用来看清中文正文的行距与字距：**加粗**、*斜体*、`行内代码`、[站内链接](/about/) 都在同一行里。

> 引用块用霞鹜文楷（LXGW Bright），左侧有一条浅色装饰线，颜色比正文淡一档。

无序列表：

- 第一项：列表项之间留 0.3rem
- 第二项：带一点补充 `inline`
  - 嵌套的子项与父级同字号

有序列表：

1. 第一步：先用 `--momo-*` token
2. 第二步：再写组件样式

```ts title="tokens.ts" {3}
export function readToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
```

| 层级 | 存放位置 | 典型例子 |
| --- | --- | --- |
| Token | `variables.css` | `--momo-radius-lg` |
| Base | `global.css` | `body` / `::selection` |
| Component | `components.css` | `.momo-card` |
| Feature | 页面 / 组件私有样式 | `.ds-swatch` |

![封面示例图](/cover.jpg "图注：图片统一 8px 圆角，图注居中且比正文小一档")
