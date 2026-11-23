// backup.js — pnpm momo backup：默认只备份 src/config.ts（--config 全部配置，--all 再加文章）
import { join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import {
  BACKUP_DIR,
  CONFIG_PATHS,
  CONTENT_PATHS,
  USER_CONFIG_PATHS,
  c,
  copyPath,
  ensureDir,
  fail,
  formatBytes,
  fromRoot,
  gitInfo,
  isInsideRoot,
  listFiles,
  log,
  pathExists,
  pathSize,
  pnpmVersion,
  readJson,
  relPath,
  writeJson,
  capture,
} from '../lib.js'

/** 备份目录名：可按名称排序的时间戳 */
function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  )
}

// 备份模式 → 列表展示名称（config / all 兼容旧备份的 manifest）
const MODE_LABELS = {
  user: '仅 config.ts',
  config: '全部配置',
  all: '配置+内容',
}

const MODE_TITLES = {
  user: 'src/config.ts',
  config: '全部配置文件',
  all: '全部配置与文章内容',
}

const MODE_PATHS = {
  user: USER_CONFIG_PATHS,
  config: CONFIG_PATHS,
  all: [...CONFIG_PATHS, ...CONTENT_PATHS],
}

/** 列出已有备份（按时间倒序） */
export async function listBackups(outDir) {
  const names = await readdir(outDir, { withFileTypes: true }).catch(() => [])
  const backups = []
  for (const entry of names) {
    if (!entry.isDirectory()) continue
    const dir = join(outDir, entry.name)
    const manifest = await readJson(join(dir, 'manifest.json'))
    backups.push({
      name: entry.name,
      dir,
      manifest,
      createdAt: manifest?.createdAt ?? (await stat(dir)).mtime.toISOString(),
      mode: manifest?.mode ?? '未知',
      files: manifest?.files ?? null,
      bytes: manifest?.bytes ?? (await pathSize(dir)),
    })
  }
  return backups.sort((a, b) => b.name.localeCompare(a.name))
}

export function printBackups(backups, outDir) {
  if (!backups.length) {
    log.info(`${c.gray('（空）')} 还没有任何备份`)
    return
  }
  log.info(`${backups.length} 个备份，位于 ${c.cyan(relPath(outDir))}`)
  for (const item of backups) {
    const time = new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })
    const mode = MODE_LABELS[item.mode] ?? '未知'
    const size = `${item.files ?? '?'} 个文件 / ${formatBytes(item.bytes)}`
    log.info(`  ${c.bold(item.name)}  ${c.gray(time)}  ${c.gray(mode)}  ${c.gray(size)}`)
  }
}

export default {
  name: 'backup',
  summary: '备份 src/config.ts（--config 全部配置，--all 再加文章内容）',
  usage: 'pnpm momo backup [--config] [--all] [--name <名称>] [--out <目录>] [--list]',
  details: [
    '默认只备份需要你自己修改的配置文件：',
    `  ${USER_CONFIG_PATHS.join('、')}`,
    '加上 --config 会备份全部配置文件：',
    `  ${CONFIG_PATHS.join('、')}`,
    '加上 --all 会备份全部配置文件，并连同文章与图片：',
    `  ${CONTENT_PATHS.join('、')}`,
  ].join('\n'),
  options: {
    config: { alias: 'c', type: 'boolean', desc: '备份全部配置文件（默认只备份 src/config.ts）' },
    all: { alias: 'a', type: 'boolean', desc: '备份全部配置文件，并连同文章内容与图片' },
    name: { type: 'string', desc: '自定义备份名称（默认按时间戳）' },
    out: { type: 'string', desc: `备份根目录，默认 ${BACKUP_DIR}` },
    list: { alias: 'l', type: 'boolean', desc: '只列出已有备份' },
  },

  async run({ flags }) {
    const outDir = fromRoot(flags.out ?? BACKUP_DIR)

    if (flags.list) {
      log.title('已有备份')
      printBackups(await listBackups(outDir), outDir)
      return
    }

    // 模式优先级：--all > --config > 默认（仅 src/config.ts）
    const mode = flags.all ? 'all' : flags.config ? 'config' : 'user'
    const wanted = MODE_PATHS[mode]

    const entries = []
    for (const rel of wanted) {
      if (await pathExists(fromRoot(rel))) entries.push(rel)
    }
    if (!entries.length) fail('没有找到任何可备份的文件，请在项目根目录执行')

    const dest = join(outDir, flags.name || stamp())
    if (await pathExists(dest)) fail(`备份目录已存在：${relPath(dest)}`)

    log.title(`备份 ${MODE_TITLES[mode]}`)
    await ensureDir(dest)

    let files = 0
    let bytes = 0
    for (const rel of entries) {
      const source = fromRoot(rel)
      await copyPath(source, join(dest, ...rel.split('/')))
      const size = await pathSize(source)
      const info = await stat(source)
      const count = info.isDirectory() ? (await listFiles(source)).length : 1
      files += count
      bytes += size
      log.info(`${c.green('✓')} ${rel.padEnd(24)} ${c.gray(`${count} 个文件 / ${formatBytes(size)}`)}`)
    }

    const git = gitInfo()
    const manifest = {
      tool: 'momo',
      createdAt: new Date().toISOString(),
      mode,
      entries,
      files,
      bytes,
      git: git ? { branch: git.branch, commit: git.commit, dirty: git.dirty } : null,
      env: { node: process.version, pnpm: pnpmVersion() },
    }
    await writeJson(join(dest, 'manifest.json'), manifest)

    log.raw()
    log.ok(`备份完成：${c.bold(relPath(dest))}`)
    log.info(c.gray(`共 ${files} 个文件 / ${formatBytes(bytes)}`))
    log.info(c.gray(`恢复：pnpm momo restore ${flags.name || ''}`.trim()))

    // 备份目录在仓库内且未被忽略时会污染 git status，进而影响 momo update
    if (isInsideRoot(outDir)) {
      const ignored = capture('git', ['check-ignore', '-q', relPath(outDir)]) !== null
      if (!ignored && git) log.warn(`${relPath(outDir)} 未被 .gitignore 忽略，建议加入以免影响 momo update`)
    }
  },
}
