// mirrors.js — GitHub 访问加速：直连与公共镜像的自动探测、缓存与多源回退
//
// 背景：`api.github.com` / `codeload.github.com` 在国内经常连不上或慢到超时
// （实测某些网络下直连完全超时，而公共反代 1-2 秒就有响应），因此 `pnpm momo update`
// 不能只走直连。这里的策略是：
//   1) 候选源 = 内置公共镜像 + 用户自定义（`--mirror` / `MOMO_MIRROR`）+ GitHub 直连；
//   2) 真正下载前并行探测（源码包读一小段字节、API 取一个小 JSON），按实测速度排序；
//   3) 依次尝试，任何一步失败（连不上 / 超时 / 返回 HTML 错误页 / 内容不是源码包）就换下一个源；
//   4) 上次成功的源记在 .momo/mirror.json，一小时内直接复用，省掉探测。
//
// ⚠️ 安全：**通过第三方镜像请求时不发送 GITHUB_TOKEN**（否则 token 就交给了镜像站），
// 只有 GitHub 直连才带 Authorization；镜像转发的是公开仓库，不需要 token。
import { fromRoot, readJson, writeJson } from './lib.js'

const UA = 'momo-cli'

// 本机状态（.gitignore 已忽略）：记住上次成功的源
const CACHE_FILE = '.momo/mirror.json'
const CACHE_TTL = 60 * 60 * 1000 // 1 小时：过期后重新探测，避免一直用已经变慢的镜像

// 探测参数：源码包只读 128 KB，够判断「能不能用 + 大概多快」，不会浪费太多流量
const FILE_PROBE_BYTES = 128 * 1024
const FILE_PROBE_MIN_BYTES = 16 * 1024
const FILE_PROBE_TIMEOUT = 8000
const API_PROBE_TIMEOUT = 8000
const PROBE_CONCURRENCY = 5

// 下载：空闲超时（多久没有新数据才算失败）比「总时长上限」更合适——
// 慢速镜像只要还在传就不该被判超时，真正卡死时又能及时换源
const DEFAULT_IDLE_TIMEOUT = 45000
const DEFAULT_TOTAL_TIMEOUT = 15 * 60 * 1000

/** GitHub 直连：prefix 为空，URL 原样请求 */
export const DIRECT_SOURCE = Object.freeze({ name: 'GitHub 直连', prefix: '', direct: true })

/**
 * 内置公共镜像（都按「前缀 + 完整 GitHub 地址」的方式转发）。
 * 这些站点由第三方提供、可用性会变化，所以每个都会先探测再用，坏了自动跳过；
 * 也可以随时用 `--mirror <前缀>` 或环境变量 `MOMO_MIRROR` 换成自己信得过的。
 */
export const BUILTIN_MIRRORS = [
  { name: 'gh-proxy.com', prefix: 'https://gh-proxy.com/' },
  { name: 'ghproxy.net', prefix: 'https://ghproxy.net/' },
  { name: 'gh.catmak.name', prefix: 'https://gh.catmak.name/' },
  { name: 'ghproxy.imciel.com', prefix: 'https://ghproxy.imciel.com/' },
  { name: 'ghfast.top', prefix: 'https://ghfast.top/' },
  { name: 'github.moeyy.xyz', prefix: 'https://github.moeyy.xyz/' },
  { name: 'gh.llkk.cc', prefix: 'https://gh.llkk.cc/' },
  { name: 'hub.gitmirror.com', prefix: 'https://hub.gitmirror.com/' },
]

/** 网络/内容类错误：带上 kind，调用方据此决定「换 URL 形式」还是「直接换源」 */
export class SourceError extends Error {
  constructor(message, { kind = 'network', status = 0 } = {}) {
    super(message)
    this.name = 'SourceError'
    this.kind = kind // network | timeout | http | content
    this.status = status
  }
}

/** 镜像前缀规范化：补协议、补结尾斜杠，名字取主机名 */
export function toSource(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  let url
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  const prefix = `${url.origin}${url.pathname.replace(/\/+$/, '')}/`
  return { name: `${url.host}${url.pathname.replace(/\/+$/, '')}`, prefix }
}

/**
 * 解析镜像设置
 * - 空 / auto：直连 + 内置镜像，自动选最快的
 * - direct / off：只用 GitHub 直连
 * - 其它（可逗号分隔）：把这些前缀排在最前面，失败时仍会回退到内置镜像与直连
 */
export function mirrorMode(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.toLowerCase() === 'auto') return { mode: 'auto', custom: [] }
  if (['direct', 'off', 'none', 'false', '0'].includes(raw.toLowerCase())) return { mode: 'direct', custom: [] }
  const custom = raw
    .split(/[,\s]+/)
    .map(toSource)
    .filter(Boolean)
  return custom.length ? { mode: 'custom', custom } : { mode: 'auto', custom: [] }
}

/** 本次可用的源清单（按优先级，已去重） */
export function sourcePool(mode) {
  if (mode.mode === 'direct') return [DIRECT_SOURCE]
  const list = mode.mode === 'custom' ? [...mode.custom, ...BUILTIN_MIRRORS] : [...BUILTIN_MIRRORS]
  const seen = new Set()
  const out = []
  for (const source of [...list, DIRECT_SOURCE]) {
    if (!source || seen.has(source.prefix)) continue
    seen.add(source.prefix)
    out.push(source)
  }
  return out
}

// ---------------- 内容校验 ----------------

export const isGzip = (buffer) => buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b

/** 是不是 HTML/XML 错误页——很多镜像失效时用 200 + HTML 返回错误，必须识别出来 */
export function looksLikeHtml(head) {
  const text = head.toString('utf8', 0, 96).replace(/^\uFEFF/, '').trimStart().toLowerCase()
  return text.startsWith('<!doctype') || text.startsWith('<html') || text.startsWith('<?xml')
}

/** 下载源码包时，JSON 也只可能是错误响应（真正的源码包不会是 JSON） */
export function looksLikeErrorPage(head) {
  if (looksLikeHtml(head)) return true
  const text = head.toString('utf8', 0, 96).replace(/^\uFEFF/, '').trimStart()
  return text.startsWith('{') || text.startsWith('[')
}

/** 看起来像 tar（未压缩）或 gzip：用于判断镜像返回的到底是不是源码包 */
export function looksLikeArchive(head) {
  if (isGzip(head)) return true
  if (looksLikeErrorPage(head)) return false
  // 未压缩的 tar 头是文件名（ASCII），只需要排除明显的二进制垃圾
  return head.subarray(0, 32).every((byte) => byte === 0 || (byte >= 32 && byte < 127))
}

// ---------------- 带超时与进度的下载 ----------------

/**
 * 下载一个 URL 到内存：空闲超时（默认 45 秒没有新数据就中断）+ 总时长兜底 + 进度回调。
 * 失败一律抛 SourceError，调用方换下一个源继续。
 * @param {'archive'|'json'} [options.expect] 期望的内容：源码包会拒绝 JSON，API 只拒绝 HTML
 */
export async function fetchFile(url, { headers = {}, idleTimeout = DEFAULT_IDLE_TIMEOUT, totalTimeout = DEFAULT_TOTAL_TIMEOUT, onProgress, expect = 'archive' } = {}) {
  const controller = new AbortController()
  let timedOut = false
  let idleTimer = null
  const armIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, idleTimeout)
  }
  const totalTimer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, totalTimeout)
  const stop = () => {
    clearTimeout(idleTimer)
    clearTimeout(totalTimer)
  }
  const seconds = Math.round(idleTimeout / 1000)

  armIdle()
  const started = Date.now()
  let response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (error) {
    stop()
    throw new SourceError(
      timedOut ? `${seconds} 秒内没有响应（连接超时）` : `连接失败（${error?.message ?? error}）`,
      { kind: timedOut ? 'timeout' : 'network' },
    )
  }

  if (!response.ok) {
    stop()
    await response.body?.cancel().catch(() => {})
    throw new SourceError(`HTTP ${response.status}`, { kind: 'http', status: response.status })
  }

  const chunks = []
  let total = 0
  let head = Buffer.alloc(0)
  try {
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk)
      if (!head.length) {
        head = buffer.subarray(0, 96)
        const bad = expect === 'json' ? looksLikeHtml(head) : looksLikeErrorPage(head)
        if (bad) throw new SourceError(`返回的是网页而不是${expect === 'json' ? ' JSON' : '源码包'}（镜像可能已失效）`, { kind: 'content' })
      }
      chunks.push(buffer)
      total += buffer.length
      armIdle()
      if (onProgress) onProgress({ bytes: total, elapsed: Date.now() - started })
    }
  } catch (error) {
    stop()
    if (error instanceof SourceError) throw error
    throw new SourceError(
      timedOut ? `下载中断：${seconds} 秒没有新数据` : `传输中断（${error?.message ?? error}）`,
      { kind: timedOut ? 'timeout' : 'network' },
    )
  }
  stop()
  if (!total) throw new SourceError('返回了空内容', { kind: 'content' })
  return { buffer: Buffer.concat(chunks), bytes: total, ms: Date.now() - started }
}

// ---------------- 探测 ----------------

/** 探测源码包：拉一小段字节，验证内容并估算速度（KB/s） */
async function probeFile(source, url, { timeout = FILE_PROBE_TIMEOUT } = {}) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(source.prefix + url, {
      headers: { 'User-Agent': UA, Range: `bytes=0-${FILE_PROBE_BYTES - 1}` },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok) return { source, ok: false, note: `HTTP ${response.status}`, ms: Date.now() - started }
    let head = Buffer.alloc(0)
    let bytes = 0
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk)
      if (!head.length) head = buffer.subarray(0, 96)
      bytes += buffer.length
      if (bytes >= FILE_PROBE_BYTES) break
    }
    const ms = Date.now() - started
    if (looksLikeErrorPage(head)) return { source, ok: false, note: '返回网页', ms }
    if (bytes < FILE_PROBE_MIN_BYTES) return { source, ok: false, note: `只拿到 ${(bytes / 1024).toFixed(0)} KB`, ms }
    if (!looksLikeArchive(head)) return { source, ok: false, note: '内容不是源码包', ms }
    return { source, ok: true, bytes, ms, rate: bytes / Math.max(ms, 1) } // KB/s
  } catch (error) {
    return { source, ok: false, note: error?.name === 'AbortError' ? '探测超时' : `${error?.name ?? error}`, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

/** 探测 API：读取一个小 JSON，能解析出数组才算可用 */
async function probeApi(source, url, { timeout = API_PROBE_TIMEOUT } = {}) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(source.prefix + url, {
      headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const ms = Date.now() - started
    if (!response.ok) return { source, ok: false, note: `HTTP ${response.status}`, ms }
    const text = (await response.text()).slice(0, 256 * 1024)
    try {
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') return { source, ok: false, note: '返回的不是 JSON', ms }
      return { source, ok: true, ms }
    } catch {
      return { source, ok: false, note: '返回的不是 JSON', ms }
    }
  } catch (error) {
    return { source, ok: false, note: error?.name === 'AbortError' ? '探测超时' : `${error?.name ?? error}`, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

/** 并发探测所有源，返回按「可用优先 + 速度」排好序的结果 */
async function probePool(kind, url, pool, onStatus) {
  onStatus(`正在探测 ${pool.length} 个下载源…`)
  const probe = kind === 'file' ? probeFile : probeApi
  const queue = [...pool]
  const results = []
  const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const source = queue.shift()
      results.push(await probe(source, url))
    }
  })
  await Promise.all(workers)

  results.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1
    if (!a.ok) return a.ms - b.ms
    return kind === 'file' ? (b.rate ?? 0) - (a.rate ?? 0) : a.ms - b.ms
  })

  const usable = results.filter((item) => item.ok)
  if (usable.length) {
    onStatus(
      `可用源：${usable
        .map((item) => (kind === 'file' ? `${item.source.name} ${(item.rate / 1024).toFixed(2)} MB/s` : `${item.source.name} ${item.ms}ms`))
        .join('、')}`,
    )
  } else {
    onStatus(`没有源通过探测（${results.length} 个都失败），按默认顺序依次尝试…`)
  }
  return results
}

// ---------------- 源计划（探测 + 缓存 + 排序） ----------------

async function readCache() {
  const data = await readJson(fromRoot(CACHE_FILE), null)
  if (!data || typeof data !== 'object') return { checkedAt: 0, entries: {} }
  return { checkedAt: Number(data.checkedAt) || 0, entries: data.entries ?? {} }
}

/**
 * 创建一次运行的「源计划」：按需探测某类目标（file / api）的可用源，并记住成功的那个。
 * - `order(kind, probeUrl)`：返回尝试顺序；有新鲜缓存时直接复用，不再探测
 * - `order(kind, probeUrl, { refresh: true })`：忽略缓存重新探测（首次全失败后调用）
 * - `remember(kind, source)`：记录成功的源，供一小时内复用
 */
export function createSourcePlan({ mirror = process.env.MOMO_MIRROR, onStatus = () => {}, useCache = true } = {}) {
  const mode = mirrorMode(mirror)
  const pool = sourcePool(mode)
  const resolved = new Map()
  let cachePromise = null

  const loadCache = () => {
    cachePromise ??= readCache()
    return cachePromise
  }

  const findInPool = (prefix) => pool.find((source) => source.prefix === prefix) ?? null

  async function order(kind, probeUrl, { refresh = false } = {}) {
    const key = `${kind}:${probeUrl}`
    if (!refresh && resolved.has(key)) return resolved.get(key)

    let cachedSource = null
    if (useCache && mode.mode === 'auto') {
      const cache = await loadCache()
      const entry = cache.entries?.[kind]
      if (entry && Date.now() - cache.checkedAt < CACHE_TTL) {
        cachedSource = (entry.prefix ? findInPool(entry.prefix) : null) ?? { name: entry.name ?? entry.prefix, prefix: entry.prefix }
      }
    }

    if (cachedSource && !refresh) {
      onStatus(`沿用上次的下载源：${cachedSource.name}（一小时内直接复用，失败会自动重新探测）`)
      const result = { sources: [cachedSource, ...pool.filter((source) => source.prefix !== cachedSource.prefix)], probed: false }
      resolved.set(key, result)
      return result
    }

    // 只有一个源（例如 --mirror direct）时不必探测，直接尝试
    if (pool.length <= 1) {
      const result = { sources: pool, probed: true }
      resolved.set(key, result)
      return result
    }

    // custom 模式只探测用户点名的镜像（内置镜像留作回退，不跟用户的指定抢位置）
    const probeList = mode.mode === 'custom' ? mode.custom : pool
    const results = await probePool(kind, probeUrl, probeList, onStatus)
    const usable = results.filter((item) => item.ok).map((item) => item.source)
    // 探测失败的源排在最后当作兜底：镜像可能只是探测接口被限流，真正下载未必不行
    const failed = results.filter((item) => !item.ok).map((item) => item.source)
    const sources = []
    for (const source of [...usable, ...failed, ...pool]) {
      if (source && !sources.some((item) => item.prefix === source.prefix)) sources.push(source)
    }
    const result = { sources, probed: true }
    resolved.set(key, result)
    return result
  }

  async function remember(kind, source) {
    if (!useCache || mode.mode !== 'auto' || !source) return
    const cache = await loadCache()
    cache.entries[kind] = { name: source.name, prefix: source.prefix }
    cache.checkedAt = Date.now()
    cachePromise = Promise.resolve(cache)
    await writeJson(fromRoot(CACHE_FILE), { tool: 'momo', checkedAt: cache.checkedAt, entries: cache.entries }).catch(() => {})
  }

  return { mode, pool, order, remember }
}
