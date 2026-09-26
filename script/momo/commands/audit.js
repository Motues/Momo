// audit.js — pnpm momo audit：统计构建产物的首屏体积指标，用于优化前后对比
// 只依赖 Node 内置模块；指标口径与 TODO.md 的「基线数据」一致
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  c,
  fail,
  formatBytes,
  fromRoot,
  listFiles,
  log,
  pathExists,
  pathSize,
  readJson,
  writeJson,
} from '../lib.js'

const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i
const LINK_TAG_RE = /<link\b[^>]*>/gi
const SCRIPT_TAG_RE = /<script\b[^>]*>/gi
const REL_RE = /rel\s*=\s*["']([^"']+)["']/i
const HREF_RE = /href\s*=\s*["']([^"']+)["']/i
const SRC_RE = /src\s*=\s*["']([^"']+)["']/i

/** 统计字符串里某个正则的匹配次数 */
function countMatches(text, re) {
  return (text.match(re) ?? []).length
}

/** 把 HTML 里的资源地址还原成 dist 下的绝对路径；第三方地址返回 null */
function resolveAsset(href, distDir) {
  const clean = href.split(/[?#]/)[0]
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(clean) || clean.startsWith('//')) return null
  return join(distDir, clean.replace(/^\//, ''))
}

/** 解析单个 HTML 页面：阻塞/非阻塞样式表、外链脚本、内联脚本、类名用量 */
async function auditPage(relPath, distDir) {
  const file = join(distDir, relPath)
  if (!(await pathExists(file))) return null

  const html = await readFile(file, 'utf8')

  // <noscript> 里的样式表只在禁用 JS 时生效，算作非阻塞
  const noscriptRanges = []
  for (const match of html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)) {
    noscriptRanges.push([match.index, match.index + match[0].length])
  }
  const inNoscript = (index) => noscriptRanges.some(([start, end]) => index >= start && index < end)

  // 同一个 href 可能同时出现在非阻塞链接与 <noscript> 兜底里，按 href 去重
  const sheets = new Map()
  for (const match of html.matchAll(LINK_TAG_RE)) {
    const tag = match[0]
    const rel = (tag.match(REL_RE)?.[1] ?? '').toLowerCase()
    const isStylesheet = rel.includes('stylesheet')
    const isPreloadStyle = rel.includes('preload') && /as\s*=\s*["']style["']/i.test(tag)
    if (!isStylesheet && !isPreloadStyle) continue
    const href = tag.match(HREF_RE)?.[1]
    if (!href) continue
    const deferred = isPreloadStyle || /media\s*=\s*["']print["']/i.test(tag) || inNoscript(match.index)
    const entry = sheets.get(href) ?? { href, deferred: true, asset: resolveAsset(href, distDir) }
    // 只要有一次是阻塞加载，这一份样式表就是阻塞的
    entry.deferred = entry.deferred && deferred
    sheets.set(href, entry)
  }

  const stylesheets = []
  for (const entry of sheets.values()) {
    const exists = entry.asset ? await pathExists(entry.asset) : false
    const css = exists ? await readFile(entry.asset, 'utf8') : ''
    stylesheets.push({
      href: entry.href,
      name: entry.href.split('/').pop(),
      deferred: entry.deferred,
      bytes: exists ? await pathSize(entry.asset) : 0,
      fontFaces: countMatches(css, /@font-face/g),
    })
  }
  stylesheets.sort((a, b) => Number(a.deferred) - Number(b.deferred) || b.bytes - a.bytes)

  const scripts = []
  for (const tag of html.match(SCRIPT_TAG_RE) ?? []) {
    const src = tag.match(SRC_RE)?.[1]
    if (!src) continue
    const asset = resolveAsset(src, distDir)
    const exists = asset ? await pathExists(asset) : false
    scripts.push({ src, bytes: exists ? await pathSize(asset) : 0 })
  }

  const sum = (list, key) => list.reduce((total, item) => total + item[key], 0)
  const blocking = stylesheets.filter((sheet) => !sheet.deferred)
  const deferredSheets = stylesheets.filter((sheet) => sheet.deferred)

  return {
    path: relPath,
    htmlBytes: Buffer.byteLength(html),
    stylesheets,
    blockingCount: blocking.length,
    blockingBytes: sum(blocking, 'bytes'),
    deferredCount: deferredSheets.length,
    deferredBytes: sum(deferredSheets, 'bytes'),
    fontFaceCount: sum(stylesheets, 'fontFaces'),
    blockingFontFaces: sum(blocking, 'fontFaces'),
    scripts,
    scriptCount: scripts.length,
    scriptBytes: sum(scripts, 'bytes'),
    inlineScripts: countMatches(html, /<script(?![^>]*\bsrc=)[^>]*>/gi),
    transitionAll: countMatches(html, /transition-all/g),
    backdrop: countMatches(html, /backdrop-(?:blur|filter)/g),
  }
}

/** 统计 dist 下的字体与 _astro 资源总量 */
async function auditAssets(distDir) {
  const files = await listFiles(distDir).catch(() => [])
  const astroDir = join(distDir, '_astro')
  const fonts = files.filter((file) => FONT_EXT.test(file))
  const astro = files.filter((file) => file.startsWith(astroDir))
  const sumSizes = async (list, filter) => {
    let total = 0
    for (const file of list) {
      if (filter && !filter(file)) continue
      total += await pathSize(file)
    }
    return total
  }
  return {
    distBytes: await sumSizes(files),
    fontFiles: fonts.length,
    fontBytes: await sumSizes(fonts),
    astroCssBytes: await sumSizes(astro, (file) => file.endsWith('.css')),
    astroJsBytes: await sumSizes(astro, (file) => file.endsWith('.js')),
  }
}

/** 找一个有代表性的文章页（优先 intro/comment，其次任意 blog 页） */
async function pickArticlePage(distDir) {
  const preferred = ['blog', 'intro', 'comment', 'index.html'].join('/')
  if (await pathExists(join(distDir, ...preferred.split('/')))) return preferred
  const candidates = (await listFiles(join(distDir, 'blog')).catch(() => []))
    .filter((file) => file.endsWith(`${'index.html'}`))
    .sort()
  if (!candidates.length) return null
  return candidates[0].slice(distDir.length + 1).split('\\').join('/')
}

function showReport(report) {
  const row = (label, value) => log.info(`${label.padEnd(26)}${c.bold(value)}`)

  log.title('构建产物审计')
  log.dim(`  dist/ 共 ${formatBytes(report.distBytes)}`)

  for (const page of report.pages) {
    log.raw()
    log.raw(`${c.cyan(page.path)}`)
    row('  HTML 体积', formatBytes(page.htmlBytes))
    row('  阻塞样式表', `${page.blockingCount} 个 / ${formatBytes(page.blockingBytes)}`)
    row('  非阻塞样式表', `${page.deferredCount} 个 / ${formatBytes(page.deferredBytes)}`)
    for (const sheet of page.stylesheets) {
      const deferred = sheet.deferred ? c.yellow(' 非阻塞') : ''
      log.info(
        `    ${sheet.name.padEnd(30)}${formatBytes(sheet.bytes).padStart(9)}  @font-face ${String(sheet.fontFaces).padStart(3)}${deferred}`,
      )
    }
    row('  其中 @font-face', `${page.fontFaceCount} 条（阻塞部分 ${page.blockingFontFaces} 条）`)
    row('  外链 JS', `${page.scriptCount} 个 / ${formatBytes(page.scriptBytes)}`)
    row('  内联 <script>', `${page.inlineScripts} 个`)
    row('  transition-all', `${page.transitionAll} 处`)
    row('  backdrop 模糊', `${page.backdrop} 处`)
  }

  log.raw()
  log.raw(`${c.cyan('全站资源')}`)
  row('  dist 字体文件', `${report.fontFiles} 个 / ${formatBytes(report.fontBytes)}`)
  row('  dist/_astro CSS', formatBytes(report.astroCssBytes))
  row('  dist/_astro JS', formatBytes(report.astroJsBytes))
}

const SIZE_KEYS = /体积|CSS|JS|字节|HTML/

/** 把审计结果拍平成「指标名 -> 数值」，便于逐项对比 */
function flatten(data) {
  const out = {}
  for (const page of data.pages ?? []) {
    const prefix = page.path.replace(/\/index\.html$/, '') || 'index'
    out[`${prefix} · HTML`] = page.htmlBytes
    out[`${prefix} · 阻塞 CSS`] = page.blockingBytes
    out[`${prefix} · 非阻塞 CSS`] = page.deferredBytes
    out[`${prefix} · 阻塞 @font-face`] = page.blockingFontFaces
    out[`${prefix} · 外链 JS`] = page.scriptBytes
    out[`${prefix} · 内联 script`] = page.inlineScripts
    out[`${prefix} · transition-all`] = page.transitionAll
    out[`${prefix} · backdrop`] = page.backdrop
  }
  out['全站 · 字体文件数'] = data.fontFiles
  out['全站 · 字体体积'] = data.fontBytes
  out['全站 · _astro CSS'] = data.astroCssBytes
  out['全站 · _astro JS'] = data.astroJsBytes
  return out
}

/** 与基线 JSON 逐项对比，输出「当前 / 基线 / 变化」三列 */
function compareWithBaseline(current, baseline) {
  const before = flatten(baseline)
  const after = flatten(current)
  const width = Math.max(...Object.keys(after).map((key) => key.length)) + 2

  log.title('与基线对比')
  for (const [key, value] of Object.entries(after)) {
    const old = before[key]
    const sizeLike = SIZE_KEYS.test(key)
    const fmt = (n) => (sizeLike ? formatBytes(n) : String(n))
    if (old === undefined) {
      log.info(`${key.padEnd(width)}${fmt(value).padStart(10)}${c.gray('   基线缺少该项')}`)
      continue
    }
    const delta = value - old
    const tag = delta === 0
      ? c.gray('±0')
      : delta < 0
        ? c.green(`-${fmt(Math.abs(delta))}`)
        : c.red(`+${fmt(Math.abs(delta))}`)
    log.info(`${key.padEnd(width)}${fmt(value).padStart(10)}  ${c.gray(fmt(old).padStart(10))}  ${tag}`)
  }
  log.raw()
  log.dim('  依次为：当前值 / 基线值 / 变化量（绿色为优化）')
}

export default {
  name: 'audit',
  summary: '统计构建产物的 CSS / JS / 字体体积与页面脚本开销',
  usage: 'pnpm momo audit [--dist <目录>] [--json] [--save <文件>] [--compare <文件>]',
  details:
    '对 dist/ 做静态统计：页面的外链样式表 / 脚本体积、@font-face 数量、内联脚本数，\n' +
    '以及全站字体文件与 _astro 资源总量。用 --save 存下基线，之后 --compare 一键对比。',
  options: {
    dist: { type: 'string', desc: '构建产物目录，默认 dist' },
    json: { type: 'boolean', desc: '以 JSON 输出（便于脚本消费）' },
    save: { type: 'string', desc: '把本次结果写入指定 JSON 文件（作为基线）' },
    compare: { type: 'string', desc: '与指定的基线 JSON 文件对比' },
  },

  async run({ flags }) {
    const distDir = fromRoot(flags.dist || 'dist')
    if (!(await pathExists(distDir))) fail('没有找到构建产物，请先执行 pnpm build')

    const articleRel = await pickArticlePage(distDir)
    const pages = []
    for (const rel of [...(articleRel ? [articleRel] : []), 'index.html']) {
      const page = await auditPage(rel, distDir)
      if (page) pages.push(page)
    }

    const result = {
      generatedAt: new Date().toISOString(),
      distDir: flags.dist || 'dist',
      ...(await auditAssets(distDir)),
      pages,
    }

    if (flags.save) {
      await writeJson(fromRoot(flags.save), result)
      log.ok(`已写入基线：${flags.save}`)
    }

    if (flags.json) log.raw(JSON.stringify(result, null, 2))
    else showReport(result)

    if (flags.compare) {
      const baseline = await readJson(fromRoot(flags.compare), null)
      if (!baseline) fail(`无法读取基线文件：${flags.compare}`)
      log.raw()
      compareWithBaseline(result, baseline)
    }
  },
}
