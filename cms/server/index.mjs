// index.mjs — Hono 应用入口（由 @hono/vite-dev-server 作为 SSR 入口加载）
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articles } from './articles.mjs'
import { preview, katexFonts } from './preview.mjs'
import { upload } from './upload.mjs'
// 注意：不能命名为 `meta` —— Vite ssrTransform 有 bug，名为 meta 的绑定会与 import.meta 冲突
import { meta as metaRouter } from './meta.mjs'
import { stats } from './stats.mjs'
import { blogContent } from './blog-content.mjs'
import { config as configRouter } from './config.mjs'
import { reveal } from './reveal.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const indexHtml = await readFile(join(__dirname, '..', 'index.html'), 'utf-8')

const app = new Hono()

app.route('/api/articles', articles)
app.route('/api/preview', preview)
app.route('/api/upload', upload)
app.route('/api/meta', metaRouter)
app.route('/api/stats', stats)
app.route('/api/config', configRouter)
app.route('/api/reveal', reveal)
app.route('/blog-content', blogContent)
app.route('/katex-fonts', katexFonts)

// SPA 回退：非 API 路径一律返回 index.html（dev server 会自动注入 HMR 客户端）
app.notFound((c) => {
  const p = c.req.path
  if (p.startsWith('/api') || p.startsWith('/blog-content') || p.startsWith('/katex-fonts')) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.html(indexHtml)
})

export default app
