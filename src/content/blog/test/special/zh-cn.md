---
title: 测试自定义样式
pubDate: 2026-01-12
description: 文章功能测试
category: 测试
image: ""
draft: false
slugId: momo/test/special
---

## 引用测试

### 普通文本

:::quote

宇宙就是一座黑暗森林，每个文明都是带枪的猎人，像幽灵般潜行于林间，轻轻拨开挡路的树枝，竭力不让脚步发出一点儿声音，连呼吸都必须小心翼翼：他必须小心，因为林中到处都有与他一样潜行的猎人，如果他发现了别的生命，能做的只有一件事：开枪消灭之。

<br><right>——《三体 II：黑暗森林》</right>
:::

### 数学公式

:::quote
$E = mc^2$
:::

## 卡片测试

### 音乐卡片

::music{id="30431366"}

### Github 卡片

::github{repo="Motues/Momo"}

## 特殊语法

### 模糊效果

这是一个!!模糊!!效果。

对于桌面端，鼠标移入时，会移除模糊效果，点击后会保持3秒清晰显示；对于移动设备，点击后移除模糊效果，当同时满足点击后超过3秒和页面滑动才会变为模糊状态。

### 拼音

下面的词会显示拼音：

{拼音}(pīn|yīn)，{君の名は}(きみ||な|)

### 彩虹文字

这是一个==彩虹==文字效果。

### 下划线

这个文字下面有++下划线++效果。

### 嵌套效果

上面的样式是可以进行嵌套的，比如：

这是一个!!==模糊并且带{拼音}(pīn|yīn)的{彩虹}(cǎi|hóng)==!!

### 链接跳转

正文里的链接默认在当前标签页打开。在链接后面**紧跟**一段属性块 `{target="_blank"}`，链接就会在新标签页打开，并在文字后面追加一个右上箭头图标：

```markdown
欢迎访问 Motues 的 [Blog](https://motues.top){target="_blank"}！
```

显示如下：

欢迎访问 Motues 的 [Blog](https://motues.top){target="_blank"}！

属性块里只识别 `target`、`rel`、`class` 三个属性，写别的属性会整体放弃、按普通文字留在正文里；`rel` 始终会保留 `noopener` 与 `noreferrer`。链接里只有图片时不追加图标，避免箭头压在图片上：

```markdown
[![封面](./cover.jpg)](https://motues.top "点击查看大图"){target="_blank"}
```

> 也可以用来跳转到站内页面，例如 `[Markdown 基本功能](/blog/markdown){target="_blank"}`，写法完全一样。

## 脚注

这是文章中的一句话，我需要在这里添加一个引用上标[^1]。

这是另一句话，引用了另外一个文献[^2]。

## Typst 测试

基于 [Typst.ts](https://myriad-dreamin.github.io/typst.ts/) 实现的 Typst 渲染。

图片在黑暗模式情况的效果可能不是很好。

```typst
#set page(width: auto, height: auto, margin: 10pt)
#set text(fill: rgb("#2f61eb"), size: 20pt)

$ cal(A) = pi r^2 $

Hello from *Typst*!
```

```typst *Waves*
// Code from https://github.com/typst/packages/blob/main/packages/preview/cetz/0.4.2/gallery/waves.typ
#import "@preview/cetz:0.4.2": canvas, draw, vector, matrix

#set page(width: auto, height: auto, margin: .5cm)

#canvas({
  import draw: *

  ortho(y: -30deg, x: 30deg, {
    on-xz({
      grid((0,-2), (8,2), stroke: gray + .5pt)
    })

    // Draw a sine wave on the xy plane
    let wave(amplitude: 1, fill: none, phases: 2, scale: 8, samples: 100) = {
      line(..(for x in range(0, samples + 1) {
        let x = x / samples
        let p = (2 * phases * calc.pi) * x
        ((x * scale, calc.sin(p) * amplitude),)
      }), fill: fill)

      let subdivs = 8
      for phase in range(0, phases) {
        let x = phase / phases
        for div in range(1, subdivs + 1) {
          let p = 2 * calc.pi * (div / subdivs)
          let y = calc.sin(p) * amplitude
          let x = x * scale + div / subdivs * scale / phases
          line((x, 0), (x, y), stroke: rgb(0, 0, 0, 150) + .5pt)
        }
      }
    }

    on-xy({
      wave(amplitude: 1.6, fill: rgb(84, 219, 219, 80))
    })
    on-xz({
      wave(amplitude: 1, fill: rgb(216, 219, 90, 80))
    })
  })
})
```

## Alert 组件测试

### 单行内容测试

:::note
这是一个提示。
:::

:::tip
这是一个建议。
:::

:::important
这是一个重要事项。
:::

:::warning
这是一个警告。
:::

:::caution
这是一个危险事项。
:::


### 多行内容测试

:::tip
这是一个包含多行内容的提示框。

- 支持列表项
- 可以包含多个段落

**重点内容**：还可以包含粗体文字和其他 Markdown 元素。
:::

### 嵌套内容测试

:::warning
提示框内可以包含代码块等其他元素。

```javascript
console.log('Hello World');
```
:::

### 自定义标题测试

:::important[自定义标题]
这是一个带有自定义标题的提示框。标题会显示为“自定义标题”而不是默认的“IMPORTANT”。
:::

## Expressive Code 测试

代码块由 [Expressive Code](https://expressive-code.com/) 渲染，在语言后面追加选项即可（完整写法见 [Markdown 基本功能](/blog/markdown)）：

````
```js title="src/app.js" {3} ins={4} del={5} showLineNumbers
function greet(name) {
  // 高亮第 3 行
  console.log(`Hello, ${name}!`)
  return true // 新增
  return false // 删除
}
```
````

效果如下：

```js title="src/app.js" {3} ins={4} del={5} showLineNumbers
function greet(name) {
  // 高亮第 3 行
  console.log(`Hello, ${name}!`)
  return true // 新增
  return false // 删除
}
```

### 终端窗口与折叠

`frame="terminal"` 显示终端窗口（三个圆点），`collapse={3-6}` 折叠指定行，点击「已折叠 N 行」可以展开：

```bash frame="terminal" collapse={3-6}
pnpm install
pnpm build
# 下面是折叠起来的内容
echo "hello"
echo "world"
echo "again"
echo "more"
```

### 自动换行与无标题栏

`wrap` 让过长的代码自动换行，`frame="none"` 不显示标题栏：

```text wrap frame="none"
在黑暗森林中，每个文明都是带枪的猎人，像幽灵般潜行于林间，竭力不让脚步发出一点儿声音，连呼吸都必须小心翼翼。
```

[^1]: 这里是第一个引用的具体内容，点击前面的箭头可以跳回正文。
[^2]: 这是第二个引用的内容，支持[链接](#)。