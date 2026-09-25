// lib.js — momo CLI 的通用工具：输出、参数解析、交互确认、子进程、文件操作
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// 仓库根目录（script/momo/ -> ../../）
export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

// 用户配置：模板里唯一需要用户自己修改的文件，普通备份只包含它
export const USER_CONFIG_PATHS = ['src/config.ts']

// 配置文件：与网站结构/布局相关，升级时通常需要按 release 说明手工合并
export const CONFIG_PATHS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'astro.config.mjs',
  'ec.config.mjs',
  'svelte.config.js',
  'tsconfig.json',
  'pagefind.yml',
  'src/config.ts',
  'src/content.config.ts',
  'src/i18n',
  'src/types',
  'cms/package.json',
]

// 内容文件：文章、图片等，属于用户自己的数据
export const CONTENT_PATHS = ['src/content', 'src/assets', 'public']

// 默认备份目录
export const BACKUP_DIR = '.backup'

// ---------------- 输出 ----------------

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : String(text))

export const c = {
  bold: paint('1'),
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('34'),
  cyan: paint('36'),
  gray: paint('90'),
}

export const log = {
  title: (text) => console.log(`\n${c.bold(text)}`),
  step: (text) => console.log(`${c.cyan('›')} ${text}`),
  info: (text = '') => console.log(`  ${text}`),
  ok: (text) => console.log(`${c.green('✓')} ${text}`),
  warn: (text) => console.log(`${c.yellow('⚠')} ${text}`),
  fail: (text) => console.error(`${c.red('✗')} ${text}`),
  dim: (text) => console.log(c.gray(text)),
  raw: (text = '') => console.log(text),
}

// 面向用户的错误：只打印消息，不打印堆栈
export class CliError extends Error {}

export function fail(message) {
  throw new CliError(message)
}

// ---------------- 参数解析 ----------------

/**
 * 解析命令行参数
 * @param {string[]} argv 位置参数与选项混合的原始参数
 * @param {Record<string, {type?: 'boolean'|'string', alias?: string, default?: boolean|string, desc?: string}>} spec 选项定义
 * @returns {{positional: string[], flags: Record<string, string|boolean>}}
 */
export function parseArgs(argv, spec = {}) {
  const aliasMap = new Map()
  for (const [name, def] of Object.entries(spec)) {
    if (def.alias) aliasMap.set(def.alias, name)
  }

  const positional = []
  const flags = {}
  for (const [name, def] of Object.entries(spec)) {
    if ((def.type ?? 'boolean') === 'boolean') flags[name] = def.default ?? false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') {
      positional.push(...argv.slice(i + 1))
      break
    }
    if (arg === '-h' || arg === '--help') {
      flags.help = true
      continue
    }
    if (!arg.startsWith('-')) {
      positional.push(arg)
      continue
    }

    const isLong = arg.startsWith('--')
    let key = isLong ? arg.slice(2) : arg.slice(1)
    let value = null
    const eq = key.indexOf('=')
    if (eq >= 0) {
      value = key.slice(eq + 1)
      key = key.slice(0, eq)
    }

    // --no-xxx 取消布尔选项
    let negated = false
    if (isLong && key.startsWith('no-')) {
      key = key.slice(3)
      negated = true
    }

    const name = aliasMap.get(key) ?? key
    const def = spec[name]
    if (!def) fail(`未知选项：${arg}（用 --help 查看可用选项）`)

    const type = def.type ?? 'boolean'
    if (type === 'boolean') {
      flags[name] = !negated
      continue
    }
    if (negated) fail(`选项 --no-${key} 不适用于 ${name}`)
    if (value === null) {
      value = argv[++i]
      if (value === undefined) fail(`选项 ${arg} 需要一个值`)
    }
    flags[name] = value
  }

  return { positional, flags }
}

// 生成选项说明（用于 --help）
export function formatOptions(spec) {
  const rows = Object.entries(spec).map(([name, def]) => {
    const type = def.type ?? 'boolean'
    const left = type === 'boolean'
      ? `--${name}${def.alias ? `, -${def.alias}` : ''}`
      : `--${name} <value>${def.alias ? `, -${def.alias}` : ''}`
    return [left, def.desc ?? '']
  })
  if (!rows.length) return ''
  const width = Math.max(...rows.map(([left]) => left.length))
  return rows.map(([left, desc]) => `  ${left.padEnd(width + 2)}${desc}`).join('\n')
}

// ---------------- 交互 ----------------

/** 询问是否继续；非交互环境（CI、管道）下按默认值处理 */
export async function confirm(question, { default: def = true } = {}) {
  if (!process.stdin.isTTY) {
    log.warn(`非交互环境，${question} 默认按「${def ? '是' : '否'}」处理`)
    return def
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(`${question} ${def ? '[Y/n]' : '[y/N]'} `)).trim().toLowerCase()
    if (!answer) return def
    return ['y', 'yes', '是'].includes(answer)
  } finally {
    rl.close()
  }
}

// ---------------- 子进程 ----------------

// Windows 下 pnpm 是 .cmd，需要通过 shell 调用；优先复用当前 pnpm 的 JS 入口
function pnpmCommand(args) {
  const execPath = process.env.npm_execpath
  if (execPath && /\.(c?js|mjs)$/i.test(execPath)) {
    return { cmd: process.execPath, args: [execPath, ...args] }
  }
  return { cmd: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args }
}

const needsShell = (cmd) => process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd)
const quoteArg = (arg) => (/[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg)

// Windows 下 .cmd/.bat 必须通过 shell 执行；此时把参数拼进命令字符串，
// 而不是「shell + args 数组」（后者会触发 Node 的 DEP0190 警告且不会转义）
function spawnTarget(cmd, args) {
  if (!needsShell(cmd)) return { command: cmd, args, shell: false }
  return { command: [cmd, ...args.map(quoteArg)].join(' '), args: [], shell: true }
}

/** 执行命令并继承 stdio（可直接看到输出）；返回退出码 */
export function run(cmd, args, { cwd = ROOT, allowFail = false, quiet = false } = {}) {
  if (!quiet) log.dim(`$ ${cmd} ${args.join(' ')}`)
  const { command, args: spawnArgs, shell } = spawnTarget(cmd, args)
  const result = spawnSync(command, spawnArgs, { cwd, shell, stdio: 'inherit' })
  if (result.error) fail(`执行 ${cmd} 失败：${result.error.message}`)
  if (result.status !== 0 && !allowFail) fail(`命令执行失败（退出码 ${result.status}）：${cmd} ${args.join(' ')}`)
  return result.status ?? 0
}

/** 执行命令并捕获标准输出（失败返回 null，不打印输出） */
export function capture(cmd, args, { cwd = ROOT } = {}) {
  const { command, args: spawnArgs, shell } = spawnTarget(cmd, args)
  const result = spawnSync(command, spawnArgs, {
    cwd,
    shell,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  if (result.error || result.status !== 0) return null
  return (result.stdout ?? '').trim()
}

/** 运行 pnpm 子命令（自动适配 npm_execpath / Windows） */
export function runPnpm(args, options) {
  const { cmd, args: full } = pnpmCommand(args)
  return run(cmd, full, options)
}

/** 运行 git 命令并返回输出；失败返回 null */
export function git(args, options) {
  return capture('git', args, options)
}

/** 检测命令是否可用 */
export function hasCommand(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  return capture(probe, [cmd]) !== null
}

// ---------------- 文件操作 ----------------

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

export async function pathExists(target) {
  return existsSync(target)
}

export async function isDirectory(target) {
  const info = await stat(target).catch(() => null)
  return Boolean(info?.isDirectory())
}

/** 递归列出目录下所有文件（返回绝对路径） */
export async function listFiles(dir) {
  const out = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listFiles(full)))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

/** 递归统计目录/文件大小（字节） */
export async function pathSize(target) {
  const info = await stat(target).catch(() => null)
  if (!info) return 0
  if (info.isFile()) return info.size
  const files = await listFiles(target)
  let total = 0
  for (const file of files) total += (await stat(file)).size
  return total
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${i === 0 ? value : value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

export async function writeJson(file, value) {
  await ensureDir(dirname(file))
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/** 复制文件或目录到目标位置（保留相对结构） */
export async function copyPath(source, dest) {
  await ensureDir(dirname(dest))
  await cp(source, dest, { recursive: true, force: true })
}

export async function removePath(target) {
  await rm(target, { recursive: true, force: true })
}

/** 相对仓库根目录的路径（统一用 / 分隔，便于展示与比较） */
export function relPath(target) {
  return relative(ROOT, target).split(sep).join('/')
}

/** 目标是否位于仓库目录内 */
export function isInsideRoot(target) {
  const rel = relPath(target)
  return rel === '' || !rel.startsWith('../')
}

/** 仓库根目录下的绝对路径 */
export function fromRoot(...parts) {
  return resolve(ROOT, ...parts)
}

/** 读取当前仓库信息（非 git 仓库时返回 null） */
export function gitInfo() {
  if (!existsSync(join(ROOT, '.git'))) return null
  return {
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '',
    commit: git(['rev-parse', '--short', 'HEAD']) ?? '',
    dirty: (git(['status', '--porcelain']) ?? '') !== '',
  }
}

export function pnpmVersion() {
  const { cmd, args } = pnpmCommand(['--version'])
  return capture(cmd, args)
}
