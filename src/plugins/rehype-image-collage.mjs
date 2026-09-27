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
 *     </figure>
 *   </div>
 *   <div class="collage-item" style="--span: 2;">…</div>
 * </div>
 * ```
 * `--cols` 是每行张数，最后一行的图片用 `--span` 补满整行（例如 5 张、每行 3 张时最后一张跨 2 列）。
 * `.collage-media` 上的 `--ratio` / `--ratio-sm` 分别是桌面端与移动端算出来的宽高比（见下面的高度策略）。
 *
 * 高度策略（尽量不裁切图片）——逐行决定行高：
 * - 行高 = 该行「按自身宽高比完整显示所需高度」最小的那张图的高度，也就是这一行最宽
 *   （宽高比最大）的图片的完整高度；它完整显示不裁切，其余图片用 `object-fit: cover`
 *   按这个高度裁切。
 * - 移动端固定每行 2 张（奇数时最后一张跨 2 列），分行与桌面端不同，因此另一份值放在
 *   `.collage-ratio-sm` / `--ratio-sm` 上。
 *
 * 样式见 `src/styles/markdown.css`（CMS 预览见 `cms/server/prose.css`）。
 */
import { dirname, resolve, sep } from 'node:path'
import sharp from 'sharp'
import { REMOTE_DEFAULTS, remoteImageSize } from './image-size.mjs'

const MIN_IMAGES = 2
const WHITESPACE_ONLY = /^\s*$/

// 网络图片宽高比缓存（URL -> Promise<ratio | null>）：同一地址只抓一次
const ratioCache = new Map()

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

/** 图片节点里的 src（`<img>` 或 `<figure>` 里的第一个 `<img>`） */
function imageSrcIn(node) {
  if (node.tagName === 'img') return node.properties?.src ?? null
  const img = (node.children ?? []).find((child) => child.type === 'element' && child.tagName === 'img')
  return img?.properties?.src ?? null
}

/** 解码 URL 转义（文件名里的 % 不合法时原样返回，避免整个构建报错） */
function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 本地图片量尺寸（sharp 只读文件头，不解码整张图） */
async function localImageSize(file) {
  try {
    const { width, height } = await sharp(file).metadata()
    return width > 0 && height > 0 ? { width, height } : null
  } catch {
    return null // 文件不存在、SVG 只有 viewBox 等等：按未知处理
  }
}

/**
 * 把 markdown 里的图片地址解析成「本地文件」或「远端 URL」：
 * - `https://…`、`//host/…` → 远端（构建时抓头部量尺寸）；
 * - `/xxx.png` → `public/xxx.png`（public 目录外的路径一律拒绝）；
 * - 其它相对路径 → 相对当前 markdown 文件所在目录；
 * - `data:` / `blob:` 内联图片量不出尺寸。
 */
function imageTarget(src, { baseDir, publicDir, remote } = {}) {
  if (typeof src !== 'string' || !src) return null
  const raw = src.split(/[?#]/)[0]
  if (!raw || /^(data:|blob:)/i.test(raw)) return null
  // 关掉远端量尺寸时，网络图片直接按「未知」处理（不查缓存、不发请求）
  const remoteOff = remote?.enable === false
  if (/^https?:/i.test(raw)) return remoteOff ? null : { kind: 'remote', value: raw }
  if (raw.startsWith('//')) return remoteOff ? null : { kind: 'remote', value: `https:${raw}` }

  if (raw.startsWith('/')) {
    if (!publicDir) return null
    const file = resolve(publicDir, `.${safeDecode(raw)}`)
    const inside = file === publicDir || file.startsWith(publicDir + sep)
    return inside ? { kind: 'file', value: file } : null
  }

  return baseDir ? { kind: 'file', value: resolve(baseDir, safeDecode(raw)) } : null
}

/**
 * 图片宽高比（宽 / 高）。量不出来（远端超时、文件读不到、格式不支持）时返回 null，
 * 由调用方决定兜底方案。
 * 只有网络图片的结果会被缓存（抓取贵）；本地文件每次都读，避免图片被替换后拿到旧尺寸。
 */
async function imageRatio(src, options = {}) {
  const target = imageTarget(src, options)
  if (!target) return null

  if (target.kind !== 'remote') {
    return measureRatio(target, options).catch(() => null)
  }

  const key = `remote:${target.value}`
  if (!ratioCache.has(key)) {
    ratioCache.set(key, measureRatio(target, options).catch(() => null))
  }
  return ratioCache.get(key)
}

async function measureRatio(target, { remote } = {}) {
  if (target.kind === 'remote') {
    if (remote?.enable === false) return null
    const size = await remoteImageSize(target.value, { ...REMOTE_DEFAULTS, ...remote })
    return size && size.width > 0 && size.height > 0 ? size.width / size.height : null
  }
  const size = await localImageSize(target.value)
  return size && size.width > 0 && size.height > 0 ? size.width / size.height : null
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

/** 按每张图的占列数分行（与 grid 自动排布一致：一行放不下就换行），返回每行的下标数组 */
export function splitRows(spans, columns) {
  const rows = []
  let row = []
  let used = 0
  spans.forEach((span, index) => {
    row.push(index)
    used += span
    if (used >= columns) {
      rows.push(row)
      row = []
      used = 0
    }
  })
  if (row.length) rows.push(row)
  return rows
}

/**
 * 一行的「高度因子」：各图按自身宽高比完整显示所需的高度（单位：列宽）里的最小值，
 * 也就是这一行最宽（宽高比最大）的那张图所需的高度。
 * 行高取它，最宽的图完整显示、其余图按这个高度裁切，整行裁切最少。
 * 量不出宽高比的图片（远端超时、内联图片等）不参与计算，按这个行高裁切；
 * 整行都量不出来时返回 null，退回固定行高 + 裁切。
 */
function rowHeightFactor(indexes, ratios, spans) {
  let factor = Infinity
  for (const index of indexes) {
    const ratio = ratios[index]
    if (!ratio) continue
    factor = Math.min(factor, spans[index] / ratio)
  }
  return Number.isFinite(factor) && factor > 0 ? factor : null
}

/**
 * 每张图该用的 `aspect-ratio`：`占列数 / 行高因子`。
 * 因为 aspect-ratio 相对图片自身宽度，这样同一行（无论是否跨列、无论几列布局、
 * 容器多宽）算出来的高度都等于「列宽 × 行高因子」，即最宽图片的完整高度。
 */
function rowAspectRatios(rows, ratios, spans) {
  const out = new Map()
  for (const row of rows) {
    const factor = rowHeightFactor(row, ratios, spans)
    if (factor === null) continue
    for (const index of row) out.set(index, spans[index] / factor)
  }
  return out
}

/**
 * 把图片节点包进 `.collage-media`（裁切 / hover 缩放用）。
 * `<figure>` 里的 `<figcaption>` 直接丢弃：拼图里不再显示图注文字。
 */
function wrapImage(node, { classes = [], style = null } = {}) {
  const mediaOf = (img) => ({
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['collage-media', ...classes],
      ...(style ? { style } : {}),
    },
    children: [img],
  })
  if (node.tagName === 'img') return mediaOf(node)
  // <figure>：只保留 <img>（丢掉图注），并把它包进 .collage-media
  return {
    ...node,
    children: (node.children ?? [])
      .filter((child) => !(child.type === 'element' && child.tagName === 'figcaption'))
      .map((child) => (child.type === 'element' && child.tagName === 'img' ? mediaOf(child) : child)),
  }
}

/** 用一组图片节点构造拼图容器 */
async function createCollage(images, maxColumns, imageOptions) {
  const count = images.length
  const columns = pickCollageColumns(count, maxColumns)
  // 最后一行的图片按列数均分整个宽度（不能整除时前面的多占一列），避免行尾留空
  const lastRow = count % columns === 0 ? columns : count % columns
  const base = Math.floor(columns / lastRow)
  const extra = columns % lastRow

  const spans = images.map((_, index) => {
    const rank = index - (count - lastRow)
    return rank < 0 ? 1 : base + (rank < extra ? 1 : 0)
  })
  const ratios = await Promise.all(images.map((image) => imageRatio(imageSrcIn(image), imageOptions)))

  // 桌面端按 --cols 分行；移动端固定每行 2 张（总数为奇数时最后一张跨 2 列），两者分行不同，各算一次
  const desktopRows = splitRows(spans, columns)
  const mobileSpans = spans.map((_, index) => (count % 2 === 1 && index === count - 1 ? 2 : 1))
  const mobileRows = splitRows(mobileSpans, 2)
  // 两套布局各自「按行算高度」：同一个值（图片宽高比一致时）就是原比例完整显示，
  // 不一致时则取行内最宽图片的高度，其余图片按这个高度裁切
  const desktopAr = rowAspectRatios(desktopRows, ratios, spans)
  const mobileAr = rowAspectRatios(mobileRows, ratios, mobileSpans)
  const round = (value) => Number(value.toFixed(4))

  const children = images.map((image, index) => {
    const classes = [
      ...(desktopAr.has(index) ? ['collage-ratio'] : []),
      ...(mobileAr.has(index) ? ['collage-ratio-sm'] : []),
    ]
    // 两套布局的宽高比可能不同（分行不同），所以各存一个变量
    const style = [
      desktopAr.has(index) ? `--ratio: ${round(desktopAr.get(index))};` : '',
      mobileAr.has(index) ? `--ratio-sm: ${round(mobileAr.get(index))};` : '',
    ]
      .filter(Boolean)
      .join(' ')
    return {
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['collage-item'],
        ...(spans[index] > 1 ? { style: `--span: ${spans[index]};` } : {}),
      },
      children: [wrapImage(image, { classes, style: style || null })],
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
async function collapseChildren(parent, imageOptions, maxColumns, minImages) {
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

    next.push(await createCollage(blocks.flat(), maxColumns, imageOptions))
    changed = true
    index = last + 1
  }

  if (changed) parent.children = next
}

/** 自顶向下遍历（先处理父节点，再进入子节点；拼图节点里的 figure/img 不会再次命中图片块） */
async function collapseTree(node, imageOptions, maxColumns, minImages) {
  if (!Array.isArray(node.children)) return
  await collapseChildren(node, imageOptions, maxColumns, minImages)
  for (const child of node.children) {
    await collapseTree(child, imageOptions, maxColumns, minImages)
  }
}

export function rehypeImageCollage(options = {}) {
  const {
    enable = true,
    maxColumns = 4,
    minImages = MIN_IMAGES,
    // 图片定位：Astro 构建时文章目录取 vfile 的路径，CMS 预览没有文件路径，由调用方传入
    baseDir = null,
    // /xxx.png 这类绝对路径对应的 public 目录
    publicDir = null,
    // 网络图片：构建时抓头部解析宽高（{ enable, timeout, maxBytes }）
    remote = null,
  } = options ?? {}

  return async (tree, file) => {
    if (!enable) return
    const imageOptions = {
      baseDir: baseDir ?? (file?.path ? dirname(String(file.path)) : null),
      publicDir,
      remote,
    }
    await collapseTree(tree, imageOptions, maxColumns, minImages)
  }
}
