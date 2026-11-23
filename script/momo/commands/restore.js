// restore.js — pnpm momo restore：从备份恢复配置文件（可选连同内容）
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import {
  BACKUP_DIR,
  c,
  confirm,
  copyPath,
  fail,
  formatBytes,
  fromRoot,
  log,
  pathExists,
  readJson,
  relPath,
} from '../lib.js'
import { listBackups, printBackups } from './backup.js'

/** 从备份目录推断要恢复的条目（没有 manifest 时退化为扫描顶层） */
async function entriesOf(dir, manifest) {
  if (Array.isArray(manifest?.entries) && manifest.entries.length) return manifest.entries
  const items = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return items.filter((e) => e.name !== 'manifest.json').map((e) => e.name)
}

export default {
  name: 'restore',
  summary: '从备份恢复文件（默认最近一次备份）',
  usage: 'pnpm momo restore [备份名称] [--out <目录>] [--list] [--yes]',
  details: '恢复会用备份中的文件覆盖当前文件；不会删除备份里没有的文件。',
  options: {
    out: { type: 'string', desc: `备份根目录，默认 ${BACKUP_DIR}` },
    list: { alias: 'l', type: 'boolean', desc: '只列出已有备份' },
    yes: { alias: 'y', type: 'boolean', desc: '跳过确认' },
    'dry-run': { type: 'boolean', desc: '只显示将要恢复的文件，不写入' },
  },

  async run({ positional, flags }) {
    const outDir = fromRoot(flags.out ?? BACKUP_DIR)
    const backups = await listBackups(outDir)

    if (flags.list) {
      log.title('已有备份')
      printBackups(backups, outDir)
      return
    }
    if (!backups.length) fail(`还没有任何备份，先执行 pnpm momo backup`)

    const name = positional[0]
    const target = name ? backups.find((b) => b.name === name) : backups[0]
    if (!target) {
      log.fail(`找不到备份：${name}`)
      printBackups(backups, outDir)
      process.exitCode = 1
      return
    }

    const manifest = target.manifest ?? (await readJson(join(target.dir, 'manifest.json')))
    const entries = await entriesOf(target.dir, manifest)

    log.title('从备份恢复')
    log.info(`备份：${c.bold(target.name)}  ${c.gray(new Date(target.createdAt).toLocaleString('zh-CN', { hour12: false }))}`)
    if (manifest?.git?.commit) log.info(`来源版本：${c.gray(`${manifest.git.branch}@${manifest.git.commit}`)}`)
    log.info(`将恢复 ${entries.length} 项：${c.gray(entries.join('、'))}`)
    if (target.bytes) log.info(c.gray(`备份大小 ${formatBytes(target.bytes)}`))
    log.warn('当前同名文件会被覆盖')

    if (flags['dry-run']) {
      log.raw()
      for (const rel of entries) {
        const exists = await pathExists(join(target.dir, ...rel.split('/')))
        log.info(`${exists ? c.green('✓') : c.yellow('⚠')} ${rel}${exists ? '' : c.gray('（备份中不存在，跳过）')}`)
      }
      log.raw()
      log.dim('（--dry-run：未写入任何文件）')
      return
    }

    if (!flags.yes) {
      const ok = await confirm('确认恢复？', { default: false })
      if (!ok) {
        log.dim('已取消')
        return
      }
    }

    let restored = 0
    for (const rel of entries) {
      const source = join(target.dir, ...rel.split('/'))
      if (!(await pathExists(source))) {
        log.warn(`${rel} 在备份中不存在，已跳过`)
        continue
      }
      await copyPath(source, fromRoot(rel))
      restored++
      log.info(`${c.green('✓')} ${rel}`)
    }

    log.raw()
    log.ok(`恢复完成，共 ${restored} 项（备份位于 ${relPath(target.dir)}）`)
    const depFiles = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cms/package.json']
    if (entries.some((rel) => depFiles.includes(rel))) {
      log.info(c.gray('建议执行 pnpm install 让依赖与配置保持一致'))
    }
  },
}
