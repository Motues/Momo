// clean.js — pnpm momo clean：清理构建产物与缓存
import {
  c,
  confirm,
  fail,
  formatBytes,
  fromRoot,
  isInsideRoot,
  log,
  pathExists,
  pathSize,
  relPath,
  removePath,
} from '../lib.js'

const CACHE_TARGETS = [
  { path: 'dist', desc: 'Astro 构建产物' },
  { path: '.astro', desc: 'Astro 生成的类型与内容缓存' },
  { path: 'node_modules/.astro', desc: 'Astro 内容层缓存（markdown 的渲染结果，改了 remark / rehype 插件必须清）' },
  { path: 'node_modules/.vite', desc: 'Vite 依赖预构建缓存' },
  { path: 'cms/dist', desc: 'CMS 构建产物' },
  { path: 'cms/node_modules/.vite', desc: 'CMS 的 Vite 缓存' },
]

const ALL_TARGETS = [
  { path: 'node_modules', desc: '根项目依赖（需重新 pnpm install）' },
  { path: 'cms/node_modules', desc: 'CMS 依赖（需重新 pnpm install）' },
]

export default {
  name: 'clean',
  summary: '清理构建产物与缓存（--all 连同 node_modules）',
  usage: 'pnpm momo clean [--all] [--dry-run] [--yes]',
  options: {
    all: { alias: 'a', type: 'boolean', desc: '同时删除 node_modules（需重新安装依赖）' },
    'dry-run': { type: 'boolean', desc: '只显示将要删除的内容，不实际删除' },
    yes: { alias: 'y', type: 'boolean', desc: '跳过确认' },
  },

  async run({ flags }) {
    const targets = [...CACHE_TARGETS, ...(flags.all ? ALL_TARGETS : [])]

    const found = []
    for (const target of targets) {
      const dir = fromRoot(target.path)
      if (!isInsideRoot(dir)) fail(`拒绝删除仓库外的路径：${dir}`)
      if (await pathExists(dir)) found.push({ ...target, dir, bytes: await pathSize(dir) })
    }

    log.title('清理目标')
    if (!found.length) {
      log.info('没有需要清理的内容')
      return
    }
    let total = 0
    for (const item of found) {
      total += item.bytes
      log.info(`${c.yellow('•')} ${item.path.padEnd(24)} ${c.gray(`${formatBytes(item.bytes)}  ${item.desc}`)}`)
    }
    log.raw()
    log.info(`合计可释放 ${c.bold(formatBytes(total))}`)

    if (flags['dry-run']) {
      log.raw()
      log.dim('（--dry-run：未删除任何文件）')
      return
    }

    if (!flags.yes) {
      const ok = await confirm('确认删除？', { default: !flags.all })
      if (!ok) {
        log.dim('已取消')
        return
      }
    }

    log.raw()
    for (const item of found) {
      await removePath(item.dir)
      log.info(`${c.green('✓')} 已删除 ${relPath(item.dir)}`)
    }
    log.raw()
    log.ok(`清理完成，释放 ${formatBytes(total)}`)
    if (flags.all) log.info(c.gray('已删除 node_modules，请执行 pnpm install 重新安装依赖'))
  },
}
