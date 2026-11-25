// media.mjs — 媒体库 API：统一管理 src/content/blog/** 与 public/** 下的图片
// 所有路径都必须经 safeRel + 根目录边界双重校验，禁止目录穿越。
import { Hono } from 'hono'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile, mkdir, stat, unlink, rename } from 'node:fs/promises'
import { join, dirname, basename, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOG_DIR, safeRel, scanArticles } from './store.mjs'

export const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url))
// 引用扫描范围：文章 / 页面文案、组件、样式与根目录配置（构建期真正会读到图片的地方）
const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url))
const SRC_DIR = fileURLToPath(new URL('../../src/', import.meta.url))
const CONTENT_DIR = fileURLToPath(new URL('../../src/content/', import.meta.url))
const ROOT_CONFIG_FILES = ['astro.config.mjs', 'ec.config.mjs']

const MEDIA_ROOTS = { blog: BLOG_DIR, public: PUBLIC_DIR }

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico'])
const IGNORED_DIRS = new Set([
  'node_modules', 'dist', '.astro', '.git', '.backup', '.momo', '.cache', '.vite',
])
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const MAX_FILES = 2000
const MAX_UPLOAD = 20 * 1024 * 1024 // 20MB
const LONG_EDGE = 2400
const QUALITY = 82
const IO_CONCURRENCY = 8

// sharp 是原生依赖，加载失败时退化：上传不压缩、宽高走文件头解析
let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  sharp = null
}

// ---------- 通用小工具 ----------

function normalizeScope(value) {
  return value === 'blog' || value === 'public' ? value : null
}

function relOf(root, abs) {
  return abs.slice(resolve(root).length).replace(/\\/g, '/').replace(/^\//, '')
}

function dirOf(rel) {
  const dir = dirname(rel).replace(/\\/g, '/')
  return dir === '.' || dir === '' ? '.' : dir
}

// 把相对路径拼到根目录下并确认结果仍在根目录内（safeRel 已挡住 `..`，这里再兜一层）
function inside(root, rel) {
  const base = resolve(root)
  const abs = resolve(base, ...rel.split('/').filter(Boolean))
  if (abs !== base && !abs.startsWith(base + sep)) return null
  return abs
}

function isImageName(name) {
  return IMAGE_EXTS.has(extname(name).toLowerCase())
}

function altNameOf(rel) {
  return basename(rel, extname(rel))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fileUrl(scope, rel) {
  return `/api/media/file?scope=${encodeURIComponent(scope)}&path=${rel.split('/').map(encodeURIComponent).join('/')}`
}

// 有界并发 map，顺序与输入一致
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- 目录扫描 ----------

// 递归收集图片；同时记录「含 markdown 的目录」，用于把 blog 图片归到它所属的文章下
async function scanScope(scope) {
  const root = MEDIA_ROOTS[scope]
  const files = []
  const articleDirs = new Set()
  const dirs = new Set()
  let truncated = false
  const queue = [root]

  while (queue.length) {
    const dir = queue.shift()
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        dirs.add(relOf(root, full))
        queue.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (
        scope === 'blog' &&
        extname(entry.name).toLowerCase() === '.md' &&
        !entry.name.startsWith('_')
      ) {
        articleDirs.add(relOf(root, dir))
      }
      if (!isImageName(entry.name)) continue
      if (files.length >= MAX_FILES) {
        truncated = true
        break
      }
      files.push(full)
    }
    // 达到上限就停止遍历，避免超大目录把一次列表请求拖到很久
    if (truncated) break
  }

  return { root, files, articleDirs, dirs, truncated }
}

// 找图片所属的文章目录：从所在目录往上找第一个含 .md 的目录
function articleDirOf(rel, articleDirs) {
  let dir = dirOf(rel)
  while (true) {
    if (articleDirs.has(dir)) return dir
    if (dir === '.' || !dir) return null
    const i = dir.lastIndexOf('/')
    dir = i < 0 ? '.' : dir.slice(0, i)
  }
}

// 上传 / 重命名后单张图片使用：按文件系统实际检查，不依赖整次目录扫描
async function resolveArticleDir(root, rel) {
  let dir = dirOf(rel)
  while (true) {
    const abs = dir === '.' ? root : join(root, ...dir.split('/'))
    const entries = await readdir(abs).catch(() => [])
    if (entries.some((name) => name.endsWith('.md') && !name.startsWith('_'))) return dir
    if (dir === '.' || !dir) return null
    const i = dir.lastIndexOf('/')
    dir = i < 0 ? '.' : dir.slice(0, i)
  }
}

// ---------- 宽高读取（sharp 优先，失败时解析文件头） ----------

const metaCache = new Map() // absPath -> { key, width, height }

async function imageMeta(file, st) {
  const key = `${st.mtimeMs}:${st.size}`
  const cached = metaCache.get(file)
  if (cached && cached.key === key) return cached

  let width = null
  let height = null
  if (sharp) {
    try {
      const meta = await sharp(file).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      /* 交给下面的文件头解析 */
    }
  }
  if (!width || !height) {
    const dim = await readSize(file)
    width = width ?? dim?.width ?? null
    height = height ?? dim?.height ?? null
  }

  const entry = { key, width, height }
  metaCache.set(file, entry)
  return entry
}

async function readSize(file) {
  const buf = await readFile(file).catch(() => null)
  if (!buf) return null
  if (extname(file).toLowerCase() === '.svg') return svgSize(buf)
  return headerSize(buf)
}

function headerSize(buf) {
  // PNG：8 字节签名 + IHDR
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // GIF：逻辑屏幕宽高
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }
  // WebP：RIFF....WEBP
  if (
    buf.length >= 30 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return webpSize(buf)
  }
  // JPEG：扫描 SOF 段
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf)
  return null
}

function webpSize(buf) {
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8X') {
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
    }
  }
  if (chunk === 'VP8 ') {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    }
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }
  return null
}

function jpegSize(buf) {
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xda || marker === 0xd9) return null // 进入压缩数据，后面没有 SOF 了
    const len = buf.readUInt16BE(i + 2)
    if (len < 2) return null
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  return null
}

function svgSize(buf) {
  const text = buf.toString('utf8', 0, Math.min(buf.length, 8192))
  const width = text.match(/\swidth\s*=\s*["']?\s*([\d.]+)/i)
  const height = text.match(/\sheight\s*=\s*["']?\s*([\d.]+)/i)
  if (width && height) {
    return { width: Math.round(Number(width[1])) || null, height: Math.round(Number(height[1])) || null }
  }
  const viewBox = text.match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: Math.round(parts[2]), height: Math.round(parts[3]) }
    }
  }
  return null
}

// ---------- 列表项 ----------

async function toItem(scope, root, file, articleDirs) {
  const st = await stat(file).catch(() => null)
  if (!st?.isFile()) return null
  const rel = relOf(root, file)
  const meta = await imageMeta(file, st)
  const articleDir = scope === 'blog' ? articleDirOf(rel, articleDirs) : null
  return {
    path: rel,
    name: basename(rel),
    dir: scope === 'blog' ? (articleDir ?? '.') : dirOf(rel),
    articleDir,
    url: fileUrl(scope, rel),
    size: st.size,
    width: meta.width,
    height: meta.height,
    mtime: st.mtime.toISOString(),
    altName: altNameOf(rel),
  }
}

async function listMedia(scope, q) {
  const { root, files, articleDirs, dirs, truncated } = await scanScope(scope)
  const parsed = await mapLimit(files, IO_CONCURRENCY, (file) => toItem(scope, root, file, articleDirs))
  let list = parsed.filter(Boolean)
  if (q) {
    const needle = q.toLowerCase()
    list = list.filter((item) => `${item.path} ${item.name}`.toLowerCase().includes(needle))
  }
  list.sort((a, b) => a.path.localeCompare(b.path))

  const groups = new Map()
  for (const item of list) {
    if (!groups.has(item.dir)) groups.set(item.dir, [])
    groups.get(item.dir).push(item)
  }
  const grouped = [...groups.entries()]
    .map(([dir, items]) => ({ dir, items }))
    .sort((a, b) => (a.dir === '.' ? -1 : b.dir === '.' ? 1 : a.dir.localeCompare(b.dir)))

  // 上传目录候选：blog 用「含 markdown 的文章目录」，public 用实际存在的目录；
  // 即使某个目录还没有图片（例如刚建好文章）也要能作为上传目标出现
  const uploadDirs = scope === 'blog'
    ? [...new Set([...articleDirs, ...dirs])].filter((dir) => dir !== '').sort((a, b) => a.localeCompare(b))
    : [...dirs].sort((a, b) => a.localeCompare(b))

  // 上传弹窗的目标列表：两个 scope 都返回文章目录，图片统一落到 <文章目录>/images
  const articles = (await scanArticles())
    .map((a) => ({ dir: a.path, title: a.title || a.path }))
    .sort((a, b) => a.dir.localeCompare(b.dir))

  return {
    scope,
    total: list.length,
    truncated,
    sharp: !!sharp,
    dirs: uploadDirs,
    articles,
    groups: grouped,
  }
}

// ---------- 上传：压缩 + 去重 ----------

function compressible(ext) {
  return ['.png', '.jpg', '.jpeg', '.webp', '.avif'].includes(ext)
}

// 压缩质量：10-100，非法值回落默认 82
function normalizeQuality(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return QUALITY
  return Math.min(100, Math.max(10, Math.round(n)))
}

// 长边 > 2400 等比缩小；jpeg / webp / avif 按 quality 重编码，PNG 用调色板压缩（100 = 无损），
// SVG / GIF 原样保存。force：替换图片时即使重编码变大也要按目标格式写出。
async function prepareImage(buf, ext, { force = false, quality = QUALITY } = {}) {
  if (!sharp || !compressible(ext)) return { data: buf, compressed: false, width: null, height: null }
  const q = normalizeQuality(quality)
  try {
    const meta = await sharp(buf).metadata()
    const longEdge = Math.max(meta.width || 0, meta.height || 0)
    let pipe = sharp(buf)
    if (longEdge > LONG_EDGE) {
      pipe = pipe.resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    }
    if (ext === '.png') {
      pipe = q < 100
        ? pipe.png({ compressionLevel: 9, palette: true, quality: q })
        : pipe.png({ compressionLevel: 9 })
    } else if (ext === '.jpg' || ext === '.jpeg') pipe = pipe.jpeg({ quality: q, mozjpeg: true })
    else if (ext === '.webp') pipe = pipe.webp({ quality: q })
    // AVIF 的 quality 刻度比 JPEG 更「高」：同样 82 会明显更大，按比例折算（82 → 60）
    else if (ext === '.avif') pipe = pipe.avif({ quality: Math.max(1, Math.round(q * 0.73)) })
    else return { data: buf, compressed: false, width: meta.width ?? null, height: meta.height ?? null }

    const out = await pipe.toBuffer()
    // 没有缩图、重编码反而变大时保留原图（PNG 重编码偶尔会这样）
    if (!force && out.length >= buf.length && longEdge <= LONG_EDGE) {
      return { data: buf, compressed: false, width: meta.width ?? null, height: meta.height ?? null }
    }
    const outMeta = await sharp(out).metadata().catch(() => ({}))
    return {
      data: out,
      compressed: out.length !== buf.length,
      width: outMeta.width ?? meta.width ?? null,
      height: outMeta.height ?? meta.height ?? null,
    }
  } catch {
    return { data: buf, compressed: false, width: null, height: null }
  }
}

// 只保留安全字符：沿用原名，非法字符换成连字符；扩展名必须是图片
function safeName(raw) {
  const base = basename(String(raw || 'image').replace(/\\/g, '/'))
  const ext = extname(base).toLowerCase()
  if (!IMAGE_EXTS.has(ext)) return null
  const stem = basename(base, extname(base))
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
  const safe = stem && stem !== '.' && stem !== '..' ? stem : 'image'
  return `${safe}${ext}`
}

async function uniqueName(dir, name) {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = name
  for (let i = 1; i < 1000; i++) {
    const exists = await stat(join(dir, candidate)).then(() => true).catch(() => false)
    if (!exists) return candidate
    candidate = `${stem}-${i}${ext}`
  }
  return `${stem}-${Date.now()}${ext}`
}

const hashCache = new Map() // absPath -> { key, hash }

async function hashFile(file, st) {
  const key = `${st.mtimeMs}:${st.size}`
  const cached = hashCache.get(file)
  if (cached && cached.key === key) return cached.hash
  const buf = await readFile(file).catch(() => null)
  if (!buf) return null
  const hash = createHash('sha256').update(buf).digest('hex')
  hashCache.set(file, { key, hash })
  return hash
}

// 在整个 scope 内按内容哈希找重复图片
async function findByHash(scope, hash) {
  const { root, files, articleDirs } = await scanScope(scope)
  const matches = await mapLimit(files, IO_CONCURRENCY, async (file) => {
    const st = await stat(file).catch(() => null)
    if (!st?.isFile()) return null
    return (await hashFile(file, st)) === hash ? file : null
  })
  const found = matches.find(Boolean)
  if (!found) return null
  return toItem(scope, root, found, articleDirs)
}

// ---------- 引用扫描：详情面板与「未引用图片」清理 ----------

const TEXT_EXTS = new Set([
  '.md', '.mdx', '.astro', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx',
  '.svelte', '.css', '.json', '.yml', '.yaml', '.html', '.txt', '.xml',
])

// 递归收集文本文件；跳过依赖 / 构建产物目录
async function collectTextFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      await collectTextFiles(full, out)
    } else if (entry.isFile() && TEXT_EXTS.has(extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
  return out
}

const textCache = new Map() // absPath -> { key, text }

async function readTextCached(file) {
  const st = await stat(file).catch(() => null)
  if (!st?.isFile()) return null
  // 单个文件超过 2MB 视为数据 / 构建产物，不参与引用匹配
  if (st.size > 2 * 1024 * 1024) return null
  const key = `${st.mtimeMs}:${st.size}`
  const cached = textCache.get(file)
  if (cached && cached.key === key) return cached.text
  const text = await readFile(file, 'utf-8').catch(() => null)
  if (text === null) return null
  textCache.set(file, { key, text })
  return text
}

// 会读到图片的文本（src/** 与根目录配置文件）拼成一个 haystack，用于判断「有没有人引用」
async function textHaystack() {
  const files = await collectTextFiles(SRC_DIR)
  for (const name of ROOT_CONFIG_FILES) files.push(join(ROOT_DIR, name))
  const parts = []
  for (const file of files) {
    const text = await readTextCached(file)
    if (text) parts.push(text)
  }
  return parts.join('\n')
}

const IMAGE_TOKEN = /[\w.\-\u4e00-\u9fff]+\.(?:png|jpe?g|gif|webp|avif|svg|ico)/gi

// 找图片被哪些 markdown 引用：按文件名做保守匹配（宁可多报，避免误删）
async function findReferences(rel) {
  const needle = basename(rel).toLowerCase()
  const files = (await collectTextFiles(CONTENT_DIR)).filter((file) => {
    const ext = extname(file).toLowerCase()
    return ext === '.md' || ext === '.mdx'
  })
  const refs = []
  for (const file of files) {
    const text = await readTextCached(file)
    if (text && text.toLowerCase().includes(needle)) {
      refs.push(file.slice(CONTENT_DIR.length).replace(/\\/g, '/'))
    }
  }
  return refs.sort()
}

// 未被任何文本引用的图片（按体积从大到小），供前端确认后批量删除
async function listUnused(scope) {
  const { root, files, articleDirs } = await scanScope(scope)
  const haystack = await textHaystack()
  const tokens = new Set()
  for (const match of haystack.matchAll(IMAGE_TOKEN)) tokens.add(match[0].toLowerCase())
  const lowerHaystack = haystack.toLowerCase()

  const parsed = await mapLimit(files, IO_CONCURRENCY, async (file) => {
    const name = basename(file).toLowerCase()
    if (tokens.has(name)) return null
    // 文件名含空格 / 特殊字符时 token 提取不到，回退到子串匹配
    if (lowerHaystack.includes(name)) return null
    return toItem(scope, root, file, articleDirs)
  })
  const unused = parsed.filter(Boolean).sort((a, b) => b.size - a.size)
  return { scope, total: files.length, unused }
}

// ---------- 路由 ----------

const media = new Hono()

// GET /api/media?scope=blog|public&q=
media.get('/', async (c) => {
  const scope = normalizeScope(c.req.query('scope'))
  if (!scope) return c.json({ error: 'scope 只能是 blog 或 public' }, 400)
  const q = (c.req.query('q') || '').trim()
  return c.json(await listMedia(scope, q))
})

// GET /api/media/file?scope=&path= —— 媒体库缩略图与原图（只读两个根目录内的图片）
media.get('/file', async (c) => {
  const scope = normalizeScope(c.req.query('scope'))
  const rel = safeRel(c.req.query('path') || '')
  if (!scope || !rel || !isImageName(rel)) return c.json({ error: '无效的图片路径' }, 400)
  const abs = inside(MEDIA_ROOTS[scope], rel)
  if (!abs) return c.json({ error: '无效的图片路径' }, 400)
  const buf = await readFile(abs).catch(() => null)
  if (!buf) return c.json({ error: '图片不存在' }, 404)
  return c.body(new Uint8Array(buf), 200, {
    'Content-Type': MIME[extname(rel).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  })
})

// POST /api/media/upload  (multipart: file + scope + dir)
media.post('/upload', async (c) => {
  const form = await c.req.parseBody().catch(() => null)
  if (!form) return c.json({ error: '无法解析表单' }, 400)

  const file = form['file']
  if (typeof File === 'undefined' || !(file instanceof File)) {
    return c.json({ error: '缺少文件字段 file' }, 400)
  }
  if (file.size > MAX_UPLOAD) return c.json({ error: '图片大小不能超过 20MB' }, 400)

  const scope = normalizeScope(form['scope'])
  if (!scope) return c.json({ error: 'scope 只能是 blog 或 public' }, 400)

  const rawDir = String(form['dir'] || '').trim().replace(/^\/+|\/+$/g, '')
  const dir = rawDir ? safeRel(rawDir) : ''
  if (dir === null) return c.json({ error: '无效的上传目录' }, 400)
  const root = MEDIA_ROOTS[scope]
  const target = inside(root, dir)
  if (!target) return c.json({ error: '无效的上传目录' }, 400)

  const name = safeName(file.name)
  if (!name) return c.json({ error: '仅支持 png / jpg / jpeg / gif / webp / avif / svg 图片' }, 400)

  const original = Buffer.from(await file.arrayBuffer())
  const quality = normalizeQuality(form['quality'])
  const prepared = await prepareImage(original, extname(name), { quality })
  const hash = createHash('sha256').update(prepared.data).digest('hex')
  const duplicate = await findByHash(scope, hash)
  if (duplicate) return c.json({ ...duplicate, duplicate, compressed: prepared.compressed, quality })

  await mkdir(target, { recursive: true })
  const finalName = await uniqueName(target, name)
  const abs = join(target, finalName)
  await writeFile(abs, prepared.data)
  hashCache.delete(abs)
  metaCache.delete(abs)

  const articleDirs = new Set()
  if (scope === 'blog') {
    const articleDir = await resolveArticleDir(root, relOf(root, abs))
    if (articleDir !== null) articleDirs.add(articleDir)
  }
  const item = await toItem(scope, root, abs, articleDirs)
  return c.json({ ...item, compressed: prepared.compressed, quality })
})

// POST /api/media/estimate  (multipart: file + quality) —— 只预估压缩后大小，不写盘
media.post('/estimate', async (c) => {
  const form = await c.req.parseBody().catch(() => null)
  if (!form) return c.json({ error: '无法解析表单' }, 400)

  const file = form['file']
  if (typeof File === 'undefined' || !(file instanceof File)) {
    return c.json({ error: '缺少文件字段 file' }, 400)
  }
  if (file.size > MAX_UPLOAD) return c.json({ error: '图片大小不能超过 20MB' }, 400)
  const name = safeName(file.name)
  if (!name) return c.json({ error: '仅支持 png / jpg / jpeg / gif / webp / avif / svg 图片' }, 400)

  const ext = extname(name).toLowerCase()
  const quality = normalizeQuality(form['quality'])
  const original = Buffer.from(await file.arrayBuffer())
  const prepared = await prepareImage(original, ext, { quality })
  const size = prepared.data.length
  return c.json({
    name,
    ext,
    quality,
    size,
    originalSize: original.length,
    width: prepared.width,
    height: prepared.height,
    compressed: prepared.compressed,
    // GIF / SVG / ICO 以及没有 sharp 的环境不会重编码
    compressible: compressible(ext) && !!sharp,
  })
})

// POST /api/media/replace  (multipart: file + scope + path) —— 原路径替换图片内容
media.post('/replace', async (c) => {
  const form = await c.req.parseBody().catch(() => null)
  if (!form) return c.json({ error: '无法解析表单' }, 400)

  const file = form['file']
  if (typeof File === 'undefined' || !(file instanceof File)) {
    return c.json({ error: '缺少文件字段 file' }, 400)
  }
  if (file.size > MAX_UPLOAD) return c.json({ error: '图片大小不能超过 20MB' }, 400)

  const scope = normalizeScope(form['scope'])
  const rel = safeRel(String(form['path'] || ''))
  if (!scope || !rel || !isImageName(rel)) return c.json({ error: '无效的图片路径' }, 400)
  const root = MEDIA_ROOTS[scope]
  const abs = inside(root, rel)
  if (!abs) return c.json({ error: '无效的图片路径' }, 400)
  const st = await stat(abs).catch(() => null)
  if (!st?.isFile()) return c.json({ error: '图片不存在' }, 404)

  const sourceExt = extname(String(file.name || '')).toLowerCase()
  if (!IMAGE_EXTS.has(sourceExt)) return c.json({ error: '只能上传图片文件' }, 400)
  // 路径（含扩展名）保持不变：格式不同时按目标扩展名重编码，GIF / SVG / ICO 只能同格式替换
  const targetExt = extname(abs).toLowerCase()
  const converting = sourceExt !== targetExt
  if (converting && !compressible(targetExt)) {
    return c.json({ error: `替换需要相同格式的图片（${targetExt}）` }, 400)
  }
  if (converting && !sharp) {
    return c.json({ error: '当前环境未加载 sharp，无法转换格式，请上传同格式图片' }, 400)
  }

  const original = Buffer.from(await file.arrayBuffer())
  const prepared = await prepareImage(original, targetExt, {
    force: converting,
    quality: normalizeQuality(form['quality']),
  })
  await writeFile(abs, prepared.data)
  hashCache.delete(abs)
  metaCache.delete(abs)

  const articleDirs = new Set()
  if (scope === 'blog') {
    const articleDir = await resolveArticleDir(root, rel)
    if (articleDir !== null) articleDirs.add(articleDir)
  }
  const item = await toItem(scope, root, abs, articleDirs)
  return c.json({ ...item, compressed: prepared.compressed })
})

// POST /api/media/move  { scope, path, targetScope, targetDir } —— 移动到其他博客目录 / public 目录
media.post('/move', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return c.json({ error: '无效请求体' }, 400)

  const scope = normalizeScope(body.scope)
  const targetScope = normalizeScope(body.targetScope)
  const rel = safeRel(body.path || '')
  if (!scope || !targetScope || !rel || !isImageName(rel)) {
    return c.json({ error: '无效的图片路径' }, 400)
  }
  const srcAbs = inside(MEDIA_ROOTS[scope], rel)
  if (!srcAbs) return c.json({ error: '无效的图片路径' }, 400)
  const st = await stat(srcAbs).catch(() => null)
  if (!st?.isFile()) return c.json({ error: '图片不存在' }, 404)

  const rawDir = String(body.targetDir || '').trim().replace(/^\/+|\/+$/g, '')
  const dirRel = rawDir ? safeRel(rawDir) : ''
  if (dirRel === null) return c.json({ error: '无效的目标目录' }, 400)
  const dstRoot = MEDIA_ROOTS[targetScope]
  const dstDir = inside(dstRoot, dirRel)
  if (!dstDir) return c.json({ error: '无效的目标目录' }, 400)
  if (resolve(dstDir) === resolve(dirname(srcAbs))) {
    return c.json({ error: '目标位置与当前位置相同' }, 400)
  }

  await mkdir(dstDir, { recursive: true })
  const finalName = await uniqueName(dstDir, basename(srcAbs))
  const dstAbs = join(dstDir, finalName)
  if (resolve(dstAbs) === resolve(srcAbs)) return c.json({ error: '目标位置与当前位置相同' }, 400)

  await rename(srcAbs, dstAbs)
  hashCache.delete(srcAbs)
  hashCache.delete(dstAbs)
  metaCache.delete(srcAbs)
  metaCache.delete(dstAbs)

  const articleDirs = new Set()
  if (targetScope === 'blog') {
    const articleDir = await resolveArticleDir(dstRoot, relOf(dstRoot, dstAbs))
    if (articleDir !== null) articleDirs.add(articleDir)
  }
  const item = await toItem(targetScope, dstRoot, dstAbs, articleDirs)
  return c.json({ ...item, movedFrom: { scope, path: rel } })
})

// GET /api/media/refs?scope=&path= —— 该图片被哪些 markdown 引用
media.get('/refs', async (c) => {
  const scope = normalizeScope(c.req.query('scope'))
  const rel = safeRel(c.req.query('path') || '')
  if (!scope || !rel || !isImageName(rel)) return c.json({ error: '无效的图片路径' }, 400)
  return c.json({ path: rel, refs: await findReferences(rel) })
})

// GET /api/media/unused?scope= —— 扫描未被任何文本引用的图片
media.get('/unused', async (c) => {
  const scope = normalizeScope(c.req.query('scope'))
  if (!scope) return c.json({ error: 'scope 只能是 blog 或 public' }, 400)
  return c.json(await listUnused(scope))
})

// DELETE /api/media?scope=&path= —— 删除单张图片
media.delete('/', async (c) => {
  const scope = normalizeScope(c.req.query('scope'))
  const rel = safeRel(c.req.query('path') || '')
  if (!scope || !rel || !isImageName(rel)) return c.json({ error: '无效的图片路径' }, 400)
  const abs = inside(MEDIA_ROOTS[scope], rel)
  if (!abs) return c.json({ error: '无效的图片路径' }, 400)
  const st = await stat(abs).catch(() => null)
  if (!st?.isFile()) return c.json({ error: '图片不存在' }, 404)
  await unlink(abs)
  hashCache.delete(abs)
  metaCache.delete(abs)
  return c.json({ ok: true, path: rel })
})

// PATCH /api/media  { scope, path, name } —— 重命名（同目录内）
media.patch('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return c.json({ error: '无效请求体' }, 400)
  const scope = normalizeScope(body.scope)
  const rel = safeRel(body.path || '')
  if (!scope || !rel || !isImageName(rel)) return c.json({ error: '无效的图片路径' }, 400)
  const abs = inside(MEDIA_ROOTS[scope], rel)
  if (!abs) return c.json({ error: '无效的图片路径' }, 400)
  const st = await stat(abs).catch(() => null)
  if (!st?.isFile()) return c.json({ error: '图片不存在' }, 404)

  const name = safeName(body.name)
  if (!name) return c.json({ error: '无效的文件名' }, 400)

  let next = abs
  if (basename(abs) !== name) {
    const dir = dirname(abs)
    const finalName = await uniqueName(dir, name)
    next = join(dir, finalName)
    await rename(abs, next)
    hashCache.delete(abs)
    metaCache.delete(abs)
  }

  const articleDirs = new Set()
  if (scope === 'blog') {
    const articleDir = await resolveArticleDir(MEDIA_ROOTS[scope], relOf(MEDIA_ROOTS[scope], next))
    if (articleDir !== null) articleDirs.add(articleDir)
  }
  const item = await toItem(scope, MEDIA_ROOTS[scope], next, articleDirs)
  return c.json(item)
})

export { media, listMedia, prepareImage, safeName, altNameOf, headerSize, jpegSize }
