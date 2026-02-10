---
title: 测试自定义样式
pubDate: 2026-01-12
description: 文章功能测试
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

### 嵌套效果

上面的样式是可以进行嵌套的，比如：

这是一个!!==模糊并且带{拼音}(pīn|yīn)的{彩虹}(cǎi|hóng)==!!

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
这是一个带有自定义标题的提示框。标题会显示为"自定义标题"而不是默认的"IMPORTANT"。
:::