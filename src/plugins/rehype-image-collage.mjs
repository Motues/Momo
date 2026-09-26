/**
 * rehype-image-collage —— 连续放置的正文图片自动拼图
 *
 * 把「多张图片连续放置」的段落合并成一个网格，并自动决定每行放几张，
 * 由 `siteConfig.theme.imageCollage`（`enable` / `maxColumns`）控制开关与每行上限。
 *
 * 识别规则（针对 customFigurePlugin 处理后的 hast 结构）：
 * - 一个「图片块」= 只包含图片的段落，即 `<p><figure><img /></figure></p>` 或 `<p><img /></p>`；
 * - 同一个段落里并排的多张图片（`![a](a.png) ![b](b.png)`）算作一块里的多张图片；
 * - 只有空白文本的节点不打断连续，其它节点（文字、标题、代码块…）都会打断；
 * - 链接里的图片（`[![alt](./a.png)](url)`）不算图片块，会打断连续（与灯箱一致：链接图片保留跳转行为）；
 * - 至少 2 张图片才拼图，单张图片保持原样（仍然是整行居中显示）。
 *
 * 输出的结构：
 * ```html
 * <div class="image-collage" style="--cols: 3;">
 *   <div class="collage-item">
 *     <figure>
 *       <div class="collage-media"><img /></div>
 *       <figcaption>图注</figcaption>
 *     </figure>
 *   </div>
 *   <div class="collage-item" style="--span: 2;">…</div>
 * </div>
 * ```
 * `--cols` 是每行张数，最后一行的图片用 `--span` 补满整行（例如 5 张、每行 3 张时最后一张跨 2 列）。
 * `<figure>` 与 `<figcaption>` 原样保留（图注照常显示在图片下方，灯箱也会读取它），
 * 只把 `<img>` 套进 `.collage-media` 以便裁切与 hover 缩放。
 * 样式见 `src/styles/markdown.css`（CMS 预览见 `cms/server/prose.css`）。
 */
import { visit } from 'unist-util-visit'

const MIN_IMAGES = 2
const WHITESPACE_ONLY = /^\s*$/

/** 图片节点：`<img>`，或 customFigurePlugin 生成的包着 `<img>` 的 `<figure>` */
function isImageNode(node) {
  if (node?.type !== 'element') return false
  if (node.tagName === 'img') return true
  if (node.tagName === 'figure') {
    return (node.children ?? []).some((child) => child.type === 'element' && child.tagName === 'img')
  }
  return false
}

function isBlankText(node) {
  return node.type === 'text' && WHITESPACE_ONLY.test(node.value)
}

/** 段落 → 其中的图片节点数组；不是「纯图片段落」时返回 null */
function imagesInBlock(node) {
  if (node?.type !== 'element' || node.tagName !== 'p') return null
  const children = (node.children ?? []).filter((child) => !isBlankText(child))
  if (!children.length) return null
  if (!children.every(isImageNode)) return null
  return children
}

/**
 * 智能选择每行张数：在 2..maxColumns 之间挑一个分数最低的方案。
 * 分数 = 最后一行空位 * 8 + 超过 3 行的额外行数 * 8 + |列数 - 行数|，
 * 即「最后一行尽量补满、整体不要太高、行列尽量接近」；同分时保留张数更多的方案。
 */
export function pickCollageColumns(count, maxColumns) {
  const limit = Math.max(2, Math.min(6, Math.floor(maxColumns) || 4))
  const start = Math.min(count, limit)
  let best = { columns: start, score: Infinity }
  for (let columns = start; columns >= 2; columns--) {
    const rows = Math.ceil(count / columns)
    const holes = rows * columns - count
    const score = holes * 8 + Math.max(0, rows - 3) * 8 + Math.abs(columns - rows)
    if (score < best.score) best = { columns, score }
  }
  return best.columns
}

/** 给图片节点里的 <img> 套一层 .collage-media（裁切 / hover 缩放用），图注仍留在 <figure> 里 */
function wrapImage(node) {
  const mediaOf = (img) => ({
    type: 'element',
    tagName: 'div',
    properties: { className: ['collage-media'] },
    children: [img],
  })
  if (node.tagName === 'img') return mediaOf(node)
  // <figure>：只把其中的 <img> 包进 .collage-media，<figcaption> 保持为 figure 的直接子节点
  return {
    ...node,
    children: (node.children ?? []).map((child) =>
      child.type === 'element' && child.tagName === 'img' ? mediaOf(child) : child,
    ),
  }
}

/** 用一组图片节点构造拼图容器 */
function createCollage(images, maxColumns) {
  const count = images.length
  const columns = pickCollageColumns(count, maxColumns)
  // 最后一行的图片按列数均分整个宽度（不能整除时前面的多占一列），避免行尾留空
  const lastRow = count % columns === 0 ? columns : count % columns
  const base = Math.floor(columns / lastRow)
  const extra = columns % lastRow

  const children = images.map((image, index) => {
    const rank = index - (count - lastRow)
    const span = rank < 0 ? 1 : base + (rank < extra ? 1 : 0)
    return {
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['collage-item'],
        ...(span > 1 ? { style: `--span: ${span};` } : {}),
      },
      children: [wrapImage(image)],
    }
  })

  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['image-collage'],
      style: `--cols: ${columns};`,
    },
    children,
  }
}

/** 把某个节点的子节点里「连续的图片块」替换成拼图容器 */
function collapseChildren(parent, maxColumns, minImages) {
  const children = parent.children
  if (!Array.isArray(children) || children.length < 2) return

  const next = []
  let changed = false
  let index = 0

  while (index < children.length) {
    const images = imagesInBlock(children[index])
    if (!images) {
      next.push(children[index])
      index += 1
      continue
    }

    // 向后收集连续的图片块（中间允许只有空白文本）
    const blocks = [images]
    let last = index
    let cursor = index + 1
    while (cursor < children.length) {
      if (isBlankText(children[cursor])) {
        cursor += 1
        continue
      }
      const more = imagesInBlock(children[cursor])
      if (!more) break
      blocks.push(more)
      last = cursor
      cursor += 1
    }

    const total = blocks.reduce((sum, images) => sum + images.length, 0)
    if (total < minImages) {
      next.push(children[index])
      index += 1
      continue
    }

    next.push(createCollage(blocks.flat(), maxColumns))
    changed = true
    index = last + 1
  }

  if (changed) parent.children = next
}

export function rehypeImageCollage(options = {}) {
  const {
    enable = true,
    maxColumns = 4,
    minImages = MIN_IMAGES,
  } = options ?? {}

  return (tree) => {
    if (!enable) return
    collapseChildren(tree, maxColumns, minImages)
    visit(tree, 'element', (node) => collapseChildren(node, maxColumns, minImages))
  }
}
