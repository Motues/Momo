#!/usr/bin/env node
// index.js — momo CLI 入口：pnpm momo <command> [options]
import { CliError, c, formatOptions, fromRoot, log, parseArgs, readJson } from './lib.js'
import backup from './commands/backup.js'
import restore from './commands/restore.js'
import update from './commands/update.js'
import newPost from './commands/new.js'
import clean from './commands/clean.js'
import doctor from './commands/doctor.js'
import audit from './commands/audit.js'

const COMMANDS = [backup, restore, update, newPost, clean, doctor, audit]

const ALIASES = {
  b: 'backup',
  up: 'update',
  n: 'new',
  doc: 'doctor',
}

function printHeader(version) {
  log.raw(`${c.bold('Momo CLI')} ${c.gray(`v${version} — 博客与 CMS 的本地工具箱`)}`)
  log.raw()
}

function printHelp(version) {
  printHeader(version)
  log.raw(`${c.bold('用法')}  pnpm momo <command> [options]`)
  log.raw()
  log.raw(c.bold('命令'))
  const width = Math.max(...COMMANDS.map((cmd) => cmd.name.length))
  for (const cmd of COMMANDS) {
    log.raw(`  ${c.cyan(cmd.name.padEnd(width + 2))}${cmd.summary}`)
  }
  log.raw()
  log.raw(c.gray('  pnpm momo <command> --help   查看某个命令的详细用法'))
  log.raw(c.gray('  pnpm momo --version          查看 CLI 版本'))
  log.raw()
  log.raw(`${c.bold('示例')}`)
  log.raw(c.gray('  pnpm momo backup              备份 src/config.ts'))
  log.raw(c.gray('  pnpm momo backup --config     备份全部配置文件'))
  log.raw(c.gray('  pnpm momo backup --all        备份全部配置和文章内容'))
  log.raw(c.gray('  pnpm momo update              从 GitHub Release 更新模板代码'))
  log.raw(c.gray('  pnpm momo update --dry-run    预览更新会改动哪些文件'))
  log.raw(c.gray('  pnpm momo new my-post         新建文章'))
}

function printCommandHelp(command) {
  log.raw()
  log.raw(`${c.bold('pnpm momo ' + command.name)}  ${c.gray(command.summary)}`)
  log.raw()
  log.raw(`${c.bold('用法')}  ${command.usage}`)
  if (command.details) {
    log.raw()
    log.raw(command.details)
  }
  const options = formatOptions(command.options ?? {})
  if (options) {
    log.raw()
    log.raw(c.bold('选项'))
    log.raw(options)
  }
  log.raw()
}

async function main() {
  const argv = process.argv.slice(2)
  const name = argv[0]
  const pkg = await readJson(fromRoot('package.json'), {})
  const version = pkg.version ?? '未知'

  if (!name || name === 'help' || name === '-h' || name === '--help') {
    const target = argv[1] ? COMMANDS.find((cmd) => cmd.name === argv[1]) : null
    if (target) printCommandHelp(target)
    else printHelp(version)
    return
  }

  if (name === 'version' || name === '-v' || name === '--version') {
    log.raw(`momo CLI（项目版本 ${version}）`)
    return
  }

  const lookup = ALIASES[name] ?? name
  const command = COMMANDS.find((cmd) => cmd.name === lookup)
  if (!command) {
    log.fail(`未知命令：${name}`)
    printHelp(version)
    process.exitCode = 1
    return
  }

  const { positional, flags } = parseArgs(argv.slice(1), command.options ?? {})
  if (flags.help) {
    printCommandHelp(command)
    return
  }

  await command.run({ positional, flags, argv: argv.slice(1) })
}

try {
  await main()
} catch (error) {
  if (error instanceof CliError) {
    log.raw()
    log.fail(error.message)
    process.exitCode = 1
  } else {
    log.raw()
    log.fail(`执行出错：${error?.message ?? error}`)
    if (process.env.MOMO_DEBUG) console.error(error)
    process.exitCode = 1
  }
}
