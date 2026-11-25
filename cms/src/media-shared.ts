// media-shared.ts — 媒体库 / 编辑器选图共用的路径、格式化与弹窗工具
import type { MediaItem, MediaScope } from './types'
import { el } from './dom'
import { toast } from './ui'

export function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

// 从 fromDir 指向 toPath 的相对路径（POSIX 风格，不含 ./ 前缀）
export function relativeAssetPath(fromDir: string, toPath: string) {
  const from = fromDir.split('/').filter(Boolean)
  const to = toPath.split('/').filter(Boolean)
  let common = 0
  while (common < from.length && common < to.length && from[common] === to[common]) common++
  const up = from.length - common
  return [...Array<string>(up).fill('..'), ...to.slice(common)].join('/')
}

// 引用写法：blog 图片相对文章目录（./images/xxx.png），public 图片相对站点根（/xxx）
// fromArticleDir 用于「从当前文章导入」：图片属于别的文章时也能算出正确的相对路径
export function mediaRef(item: MediaItem, scope: MediaScope, fromArticleDir?: string | null) {
  if (scope === 'public') return `/${item.path}`
  const base = fromArticleDir ?? item.articleDir
  if (!base) return `./${item.path}`
  const rel = relativeAssetPath(base, item.path)
  return rel.startsWith('..') ? rel : `./${rel}`
}

export function markdownFor(item: MediaItem, scope: MediaScope, fromArticleDir?: string | null) {
  const alt = item.altName || stripExt(item.name)
  return `![${alt}](${mediaRef(item, scope, fromArticleDir)})`
}

// alt 建议文案：文件名（去扩展名 / 连字符）+ 宽高
export function altFor(item: MediaItem) {
  const base = item.altName || stripExt(item.name)
  return item.width && item.height ? `${base} ${item.width}×${item.height}` : base
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function copyText(text: string, label = '已复制') {
  try {
    await navigator.clipboard.writeText(text)
    toast(label)
    return
  } catch {
    /* 非安全上下文时回退到 execCommand */
  }
  const ta = el('textarea', { class: 'media-copy-fallback' })
  ta.value = text
  document.body.append(ta)
  ta.select()
  try {
    document.execCommand('copy')
    toast(label)
  } catch {
    toast('复制失败，请手动复制', 'error')
  }
  ta.remove()
}

export function imageThumb(item: MediaItem, className = 'media-thumb') {
  const img = el('img', {
    src: item.url,
    alt: altFor(item),
    loading: 'lazy',
    decoding: 'async',
  })
  img.addEventListener('error', () => img.classList.add('is-broken'))
  return el('div', { class: className }, [img])
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i

// 拖拽回来的文件有时 type 为空，再按扩展名兜一层
export function isImageFile(file: File) {
  return file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name)
}

// 当前页面打开着的弹窗关闭函数：换路由时统一强制关掉，避免残留 Esc 监听与 blob URL
const activeOverlays = new Set<(force?: boolean) => void>()

// 弹窗统一入口：点遮罩关闭 + Esc 关闭；返回 close 供内部按钮复用
// guard 返回 false 时忽略关闭请求（例如上传进行中需要先确认）
export function createOverlay(className: string, onClose: () => void, guard?: () => boolean) {
  let closed = false
  const overlay = el('div', {
    class: `media-overlay ${className}`.trim(),
    onclick: (e: Event) => {
      if (e.target === overlay) close()
    },
  })
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  function close(force = false) {
    if (closed) return
    if (!force && guard && !guard()) return
    closed = true
    activeOverlays.delete(close)
    document.removeEventListener('keydown', onKey)
    overlay.remove()
    onClose()
  }
  activeOverlays.add(close)
  document.addEventListener('keydown', onKey)
  return { overlay, close }
}

export function closeActiveOverlays(force = true) {
  for (const close of [...activeOverlays]) close(force)
}
