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

## Special Syntax

### Blur Effect

Here is a !!blur!! effect. 

On desktop, hovering removes the blur, and clicking keeps it clear for 3 seconds. On mobile, clicking removes the blur, but it only becomes blurry again after 3 seconds have passed since the click and the page has been scrolled.

### Pinyin

Below words will show pinyin:

{拼音}(pīn|yīn)，{君の名は}(きみ||な|)

### Rainbow Text

This is an ==rainbow== text effect.

### Nested Effect

The above styles can be nested, such as:

!!==Do you like the movie {君の名は}(きみ||な|)==!!

## Typst Testing

Typst rendering based on [Typst.ts](https://myriad-dreamin.github.io/typst.ts/).

Images may not display optimally in dark mode.

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