// new.js — pnpm momo new：新建文章（frontmatter 与 src/content.config.ts 的 schema 一致）
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { c, ensureDir, fail, fromRoot, log, pathExists, relPath } from '../lib.js'

const LANGS = ['zh-cn', 'en']

/** YAML 标量：简单值直接输出，含特殊字符时用 JSON 字符串（YAML 兼容） */
function yaml(value) {
  const text = String(value ?? '')
  return /^[\w\u4e00-\u9fff][\w\u4e00-\u9fff .\-/]*$/.test(text) ? text : JSON.stringify(text)
}

/** 未指定路径时的默认路径：YYYY/YYYY-MM-DD（与 CMS 一致） */
function autoPath(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = p(date.getMonth() + 1)
  const d = p(date.getDate())
  return `${y}/${y}-${m}-${d}`
}

export default {
  name: 'new',
  summary: '新建一篇文章（默认路径按日期生成）',
  usage: 'pnpm momo new [路径] [--lang <zh-cn|en>] [--title <标题>] [--category <分类>] [--draft] [--force]',
  details: [
    '创建 src/content/blog/<路径>/<语言>.md，并写入符合 schema 的 frontmatter。',
    '路径省略时按日期生成，例如 2026/2026-09-10。',
  ].join('\n'),
  options: {
    lang: { type: 'string', desc: `语言版本，默认 zh-cn（可选 ${LANGS.join(' / ')}）` },
    title: { type: 'string', desc: '文章标题，默认取路径最后一段' },
    category: { type: 'string', desc: '文章分类' },
    draft: { type: 'boolean', desc: '标记为草稿（默认 false）' },
    force: { type: 'boolean', desc: '文件已存在时覆盖' },
  },

  async run({ positional, flags }) {
    const lang = flags.lang ?? 'zh-cn'
    if (!LANGS.includes(lang)) fail(`不支持的语言：${lang}（可选 ${LANGS.join(' / ')}）`)

    let path = (positional[0] ?? '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!path) path = autoPath()
    if (path.split('/').some((part) => part === '..')) fail('路径不能包含 ..')

    const file = join(fromRoot('src/content/blog'), ...path.split('/'), `${lang}.md`)
    if ((await pathExists(file)) && !flags.force) {
      fail(`文件已存在：${relPath(file)}（用 --force 覆盖）`)
    }

    const title = flags.title ?? path.split('/').pop()
    const today = new Date().toISOString().slice(0, 10)
    const frontmatter = [
      '---',
      `title: ${yaml(title)}`,
      `pubDate: ${today}`,
      'description: ""',
      'image: ""',
      `draft: ${flags.draft ? 'true' : 'false'}`,
      `slugId: ${yaml(path)}`,
      `category: ${yaml(flags.category ?? '')}`,
      'pinTop: 0',
      '---',
      '',
    ].join('\n')
    const body = lang === 'en'
      ? `## ${title}\n\nWrite something here...\n`
      : `## ${title}\n\n在这里开始写作…\n`

    await ensureDir(dirname(file))
    await writeFile(file, frontmatter + body, 'utf8')

    log.raw()
    log.ok(`已创建文章：${c.bold(relPath(file))}`)
    log.info(c.gray('用 pnpm dev 预览，或用 pnpm cms 在管理后台里编辑'))
  },
}
