// 与博客 src/content.config.ts 的 schema 对应
export interface FrontmatterData {
  title: string
  pubDate: string
  description: string
  image: string
  draft: boolean
  slugId: string
  category: string
  pinTop: number
  [key: string]: unknown
}

export interface ArticleSummary {
  path: string
  langs: string[]
  title: string
  description: string
  category: string
  pubDate: string
  draft: boolean
  pinTop: number
}

export interface ArticleDetail {
  path: string
  files: Record<string, { content: string; data: FrontmatterData }>
}

export interface MetaInfo {
  total: number
  drafts: number
  categories: { name: string; count: number }[]
}

export interface Stats {
  total: number
  published: number
  drafts: number
  pinned: number
  categories: { name: string; count: number }[]
  langs: Record<string, number>
  both: number
  words: { cjk: number; latin: number; total: number }
  recent: ArticleSummary[]
}

// ---- 站点配置（src/config.ts）----
// 配置是深层嵌套的自由结构，前端按路径读写，因此这里用宽松的索引类型
export type ConfigValues = Record<string, any>

export interface ConfigDoc {
  path: string
  source: string
  values: ConfigValues
  changed?: boolean
}

export interface FriendLinkItem {
  name: string
  avatar: string
  url: string
  description: string
}

// ---- 媒体库（server/media.mjs）----
export type MediaScope = 'blog' | 'public'

export interface MediaItem {
  path: string
  name: string
  /** blog：所在文章目录；public：文件所在目录（根目录为 "."） */
  dir: string
  /** 仅 blog：图片所属的文章目录；不在文章目录下时为 null */
  articleDir: string | null
  url: string
  size: number
  width: number | null
  height: number | null
  mtime: string
  /** 由文件名生成的 alt 建议（去掉扩展名、连字符） */
  altName: string
  /** 上传响应里才有：本次是否实际压缩过 */
  compressed?: boolean
}

export interface MediaGroup {
  dir: string
  items: MediaItem[]
}

/** 上传弹窗的目标：博客文章目录（图片统一落到 <dir>/images） */
export interface MediaArticleTarget {
  dir: string
  title: string
}

export interface MediaList {
  scope: MediaScope
  total: number
  truncated: boolean
  sharp: boolean
  /** 上传目录候选（blog 为文章目录，public 为实际目录） */
  dirs: string[]
  /** 文章目录与标题，供上传弹窗选择目标（两个 scope 都会返回） */
  articles: MediaArticleTarget[]
  groups: MediaGroup[]
}

export interface MediaUploadResult extends MediaItem {
  duplicate?: MediaItem
  /** 本次使用的压缩质量（10-100） */
  quality?: number
}

/** 上传前的压缩预估（/api/media/estimate，不写盘） */
export interface MediaEstimate {
  name: string
  ext: string
  quality: number
  /** 压缩后的预估字节数 */
  size: number
  originalSize: number
  width: number | null
  height: number | null
  compressed: boolean
  /** GIF / SVG / ICO 或没有 sharp 时为 false */
  compressible: boolean
}

/** 图片被哪些 markdown 引用（路径相对 src/content） */
export interface MediaRefs {
  path: string
  refs: string[]
}

export interface MediaUnused {
  scope: MediaScope
  total: number
  unused: MediaItem[]
}

export interface MediaMoveResult extends MediaItem {
  movedFrom: { scope: MediaScope; path: string }
}

export interface BatchUpdateResult {
  ok: number
  failed: { path: string; error: string }[]
}
