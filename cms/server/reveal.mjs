// reveal.mjs — 用系统默认的文件管理器打开文章所在文件夹
import { Hono } from 'hono'
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { safeRel, blogPath } from './store.mjs'

const reveal = new Hono()

// 各平台「打开目录」的命令
function opener() {
  if (process.platform === 'win32') return 'explorer.exe'
  if (process.platform === 'darwin') return 'open'
  return 'xdg-open'
}

// POST /api/reveal { path } -> { ok, dir }
reveal.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const rel = safeRel(body?.path)
  if (!rel) return c.json({ error: '无效路径' }, 400)

  const dir = blogPath(rel)
  const st = await stat(dir).catch(() => null)
  if (!st?.isDirectory()) return c.json({ error: '文章文件夹不存在' }, 404)

  try {
    // detached + ignore：不阻塞请求，也不因文件管理器退出而影响 CMS
    const child = spawn(opener(), [dir], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
  } catch (e) {
    return c.json({ error: `无法打开文件管理器: ${e?.message || e}` }, 500)
  }
  return c.json({ ok: true, dir })
})

export { reveal }
