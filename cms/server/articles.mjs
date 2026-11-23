// articles.mjs — 文章 CRUD API
import { Hono } from 'hono'
import {
  scanArticles, readArticle, saveArticle, createArticle, deleteArticle, LANGS,
} from './store.mjs'

const articles = new Hono()

const PREFIX = '/api/articles'

function rest(c) {
  const p = c.req.path
  const raw = p.slice(PREFIX.length)
  return decodeURIComponent(raw.replace(/^\//, ''))
}

// GET /api/articles?q=&category=&draft=all|published|drafts
articles.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const category = (c.req.query('category') || '').trim()
  const draft = c.req.query('draft') || 'all'

  let list = await scanArticles()
  if (category) list = list.filter((a) => a.category === category)
  if (draft === 'published') list = list.filter((a) => !a.draft)
  if (draft === 'drafts') list = list.filter((a) => a.draft)
  if (q) {
    list = list.filter((a) =>
      `${a.title} ${a.description} ${a.path} ${a.category}`.toLowerCase().includes(q),
    )
  }
  list.sort(
    (a, b) =>
      (b.pinTop - a.pinTop) ||
      (b.pubDate || '').localeCompare(a.pubDate || ''),
  )
  return c.json({ articles: list })
})

// GET /api/articles/<path>
articles.get('/*', async (c) => {
  const rel = rest(c)
  const article = await readArticle(rel)
  if (!article) return c.json({ error: '文章不存在' }, 404)
  return c.json(article)
})

// POST /api/articles  { path, lang? }
articles.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.path) return c.json({ error: 'path 不能为空' }, 400)
  const result = await createArticle(body.path, body.lang || 'zh-cn')
  if (result.error) return c.json(result, 400)
  return c.json(result)
})

// PUT /api/articles/<path>/<lang>  { data, body }
articles.put('/*', async (c) => {
  const rel = rest(c)
  const idx = rel.lastIndexOf('/')
  if (idx < 0) return c.json({ error: '路径格式错误，应为 /api/articles/<path>/<lang>' }, 400)
  const path = rel.slice(0, idx)
  const lang = rel.slice(idx + 1)
  if (!LANGS.includes(lang)) return c.json({ error: `不支持的语言: ${lang}` }, 400)

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return c.json({ error: '无效请求体' }, 400)
  const result = await saveArticle(path, lang, body)
  if (result.error) return c.json(result, 400)
  return c.json(result)
})

// DELETE /api/articles/<path>
articles.delete('/*', async (c) => {
  const rel = rest(c)
  const result = await deleteArticle(rel)
  if (result.error) return c.json(result, 404)
  return c.json(result)
})

export { articles }
