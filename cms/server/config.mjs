// config.mjs — 站点配置（src/config.ts）读写 API
import { Hono } from 'hono'
import { readConfig, writeConfig } from './config-file.mjs'

const config = new Hono()

// GET /api/config -> { path, source, values }
config.get('/', async (c) => c.json(await readConfig()))

// PUT /api/config { values } -> { path, source, values, changed }
config.put('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body.values !== 'object' || body.values === null) {
    return c.json({ error: '无效请求体，应为 { values }' }, 400)
  }
  try {
    return c.json(await writeConfig(body.values))
  } catch (e) {
    return c.json({ error: e?.message || '保存失败' }, 400)
  }
})

export { config }
