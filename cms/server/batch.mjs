// batch.mjs — 批量操作 API：批量改分类 / 置顶 / 草稿状态 / 导出 Markdown
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readArticle, saveArticle, safeRel, blogPath, LANGS } from './store.mjs'

const batch = new Hono()

const MAX_BATCH = 500
const ACTIONS = new Set(['category', 'pin', 'unpin', 'draft', 'publish'])

// 把动作应用到 frontmatter；分类 / 置顶只改字段，不会移动文件夹
function applyAction(data, action, value) {
  if (action === 'category') {
    data.category = typeof value === 'string' ? value.trim() : ''
    return
  }
  if (action === 'pin') data.pinTop = 1
  else if (action === 'unpin') data.pinTop = 0
  else if (action === 'draft') data.draft = true
  else if (action === 'publish') data.draft = false
}

// POST /api/batch/update  { paths: string[], action, value? }
batch.post('/update', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || !Array.isArray(body.paths)) return c.json({ error: 'paths 必须是数组' }, 400)

  const action = String(body.action || '')
  if (!ACTIONS.has(action)) return c.json({ error: `不支持的操作: ${action || '(空)'}` }, 400)

  const paths = [...new Set(body.paths.map((p) => safeRel(p)).filter(Boolean))].slice(0, MAX_BATCH)
  if (!paths.length) return c.json({ error: 'paths 不能为空' }, 400)

  const failed = []
  let ok = 0
  for (const path of paths) {
    try {
      const detail = await readArticle(path)
      if (!detail) throw new Error('文章不存在')
      const langs = Object.keys(detail.files)
      if (!langs.length) throw new Error('没有语言版本')
      for (const lang of langs) {
        const file = detail.files[lang]
        applyAction(file.data, action, body.value)
        const result = await saveArticle(path, lang, { data: file.data, body: file.content })
        if (result.error) throw new Error(result.error)
      }
      ok++
    } catch (e) {
      failed.push({ path, error: (e && e.message) || String(e) })
    }
  }
  return c.json({ ok, failed })
})

// ---------- 零依赖 ZIP（STORE 方式，手写 CRC32） ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  return {
    time:
      ((date.getHours() & 31) << 11) |
      ((date.getMinutes() & 63) << 5) |
      (Math.floor(date.getSeconds() / 2) & 31),
    date:
      (((date.getFullYear() - 1980) & 127) << 9) |
      (((date.getMonth() + 1) & 15) << 5) |
      (date.getDate() & 31),
  }
}

// entries: [{ name, data: Buffer }]；文件名统一 UTF-8 + 通用标志位 0x0800
export function buildZip(entries, now = new Date()) {
  if (entries.length > 65535) throw new Error('文件数量超过 ZIP 上限')
  const { time, date } = dosDateTime(now)
  const parts = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 文件名
    local.writeUInt16LE(0, 8) // 压缩方式：STORE
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    parts.push(local, name, data)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4) // version made by
    header.writeUInt16LE(20, 6) // version needed
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(0, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(date, 14)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(data.length, 20)
    header.writeUInt32LE(data.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt16LE(0, 30) // extra
    header.writeUInt16LE(0, 32) // comment
    header.writeUInt16LE(0, 34) // disk
    header.writeUInt16LE(0, 36) // internal attrs
    header.writeUInt32LE(0, 38) // external attrs
    header.writeUInt32LE(offset, 42)
    central.push(header, name)

    offset += local.length + name.length + data.length
  }

  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4) // disk
  eocd.writeUInt16LE(0, 6) // central start disk
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...parts, centralBuf, eocd])
}

function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

// GET /api/batch/export?paths=a,b,c → momo-export-YYYYMMDD-HHmm.zip
batch.get('/export', async (c) => {
  const raw = c.req.query('paths') || ''
  const paths = [...new Set(raw.split(',').map((p) => safeRel(p)).filter(Boolean))].slice(0, MAX_BATCH)
  if (!paths.length) return c.json({ error: 'paths 不能为空' }, 400)

  const entries = []
  for (const path of paths) {
    for (const lang of LANGS) {
      const buf = await readFile(join(blogPath(path), `${lang}.md`)).catch(() => null)
      if (!buf) continue
      // 原样导出 frontmatter 与正文（不经 gray-matter 重新序列化）
      entries.push({ name: `${path}/${lang}.md`, data: buf })
    }
  }
  if (!entries.length) return c.json({ error: '没有可导出的文章' }, 404)

  const zip = buildZip(entries)
  const name = `momo-export-${stamp()}.zip`
  return c.body(new Uint8Array(zip), 200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Content-Length': String(zip.length),
    'Cache-Control': 'no-store',
  })
})

export { batch, applyAction, stamp }
