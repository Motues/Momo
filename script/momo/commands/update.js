// update.js — pnpm momo update：同步模板新代码并更新依赖
//
// 两种数据源：
// - 默认对比 GitHub 最新 Release（用 package.json 的版本号判断先后），下载该标签的源码包；
// - 加 --commit <分支/标签/SHA> 时改为同步某个提交的代码（例如 --commit main 取 main 的最新提交），
//   适合第一时间用上尚未发版的新代码；此时先读远端文件树与本地的文件哈希比对，
//   --check / --dry-run 不需要下载源码包，也能直接得出「已是最新」。
//
// 两种模式都不依赖本地 git，都会保留用户自己的内容（src/content、src/assets、public、src/config.ts 等），
// 只在覆盖前把旧文件备份到 .backup/update-<时间戳>/overwritten/。
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  BACKUP_DIR,
  CONFIG_PATHS,
  CONTENT_PATHS,
  USER_CONFIG_PATHS,
  c,
  confirm,
  copyPath,
  ensureDir,
  fail,
  fromRoot,
  gitInfo,
  log,
  pathExists,
  pruneEmptyDirs,
  readJson,
  relPath,
  removePath,
  runPnpm,
  writeJson,
} from '../lib.js'
import {
  DEFAULT_REPO,
  compareTree,
  compareVersions,
  downloadRelease,
  fetchTree,
  findRelease,
  listReleases,
  listTreeFiles,
  planChanges,
  resolveCommit,
  verifyTree,
} from '../release.js'
import { BUILTIN_MIRRORS, DIRECT_SOURCE, createSourcePlan } from '../mirrors.js'
import backupCommand from './backup.js'

// 构建产物与依赖：release 源码包里本来也没有，属于双保险
const BUILD_SKIP = ['node_modules', 'dist', '.astro', '.backup', '.git']

// 用户自己的仓库配置：release 源码包里带着模板的版本，但覆盖会丢掉自己改过的工作流、
// 编辑器设置等，因此永远不参与更新（需要新模板内容时请手动对比）
const REPO_SKIP = ['.github', '.vscode', '.idea']

const ALWAYS_SKIP = [...BUILD_SKIP, ...REPO_SKIP, '.momo']

// 模板文件清单：记录一次更新后源码包里的文件列表（每次更新后重写）。
// 下次更新读它来判断「哪些文件在新版本里已经被删掉」，用户自己新增的文件不在清单里，不会被误删。
// 属于本机的状态，已加入 .gitignore，不进版本库。
const MANIFEST_FILE = '.momo/manifest.json'

// 默认保留的用户内容：文章与图片、用户自己的配置、本地 AI 工具说明与环境变量
const DEFAULT_KEEP = [
  ...CONTENT_PATHS, // src/content、src/assets、public
  ...USER_CONFIG_PATHS, // src/config.ts
  'AGENTS.md',
  'cms/AGENT.md',
  '.env',
  '.env.local',
  '.env.production',
]

const LIST_LIMIT = 12

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  )
}

const fmtDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN')
}

function printList(title, files, color = c.gray) {
  if (!files.length) return
  log.info(`${title}${c.bold(String(files.length))} 个`)
  for (const file of files.slice(0, LIST_LIMIT)) log.info(`  ${color('•')} ${file}`)
  if (files.length > LIST_LIMIT) log.info(c.gray(`  …还有 ${files.length - LIST_LIMIT} 个`))
}

/** 变更预览（release 模式读源码包、commit 模式读远端文件树，两者的清单结构一致） */
function showPreview(plan, { empty = '没有需要改动的文件' } = {}) {
  log.raw()
  log.title('变更预览')
  printList('新增：', plan.added, c.green)
  printList('修改：', plan.modified, c.yellow)
  printList('删除：', plan.removed, c.red)
  if (!plan.added.length && !plan.modified.length && !plan.removed.length) log.info(c.gray(empty))
}

/** 说明「删除」是依据哪份清单判断的 */
function printPreviousInfo(previous) {
  if (previous.label) {
    log.info(`删除判断依据：${c.gray(previous.label)}`)
    log.info(c.gray(`  （上一版模板有 ${previous.files.length} 个文件，只有这份清单里的路径才可能被删除）`))
    if (previous.truncated) log.warn('文件清单被 GitHub 截断，个别删除可能被漏掉，可稍后再执行一次 update')
  } else {
    log.info(`删除判断依据：${c.gray('无')}`)
    log.warn(
      '读取不到上一版模板的文件清单（首次使用 momo update，或远端文件树暂时不可用），' +
        '本次不删除任何文件；更新后会自动记录，下次更新起生效',
    )
  }
}

// 下载进度：单行原地刷新，最多每 400ms 一次（慢速镜像下也能看出没卡死）
const PROGRESS_INTERVAL = 400
function progressReporter() {
  let last = 0
  return ({ bytes, elapsed }) => {
    const now = Date.now()
    if (now - last < PROGRESS_INTERVAL) return
    last = now
    const mb = bytes / 1024 / 1024
    const rate = elapsed > 0 ? mb / (elapsed / 1000) : 0
    log.progress(`  ${c.cyan('↓')} 已下载 ${mb.toFixed(1)} MB（${rate.toFixed(2)} MB/s）`)
  }
}

/** 把镜像设置翻译成一句人话（打印给用户看） */
function describeMirror(mode) {
  if (mode.mode === 'direct') return '只用 GitHub 直连（--mirror direct）'
  if (mode.mode === 'custom') {
    return `优先使用 ${mode.custom.map((source) => source.name).join('、')}，失败时回退内置镜像`
  }
  return '自动选择最快的源（GitHub 直连 + 内置镜像）'
}

/** 从更新指南（doc/release_zh-cn.md）里截取某个版本的段落 */
function notesFrom(text, version) {
  if (!text || !version) return null
  const lines = text.split(/\r?\n/)
  const pattern = new RegExp(`^###\\s+v?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`)
  const start = lines.findIndex((line) => pattern.test(line))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n').trim()
}

/** 备份目录名：同秒内多次更新时自动加序号，避免与已有备份冲突 */
async function nextBackupName() {
  const base = `update-${stamp()}`
  let name = base
  let index = 2
  while (await pathExists(join(fromRoot(BACKUP_DIR), name))) {
    name = `${base}-${index}`
    index += 1
  }
  return name
}

/**
 * 取「上一版模板」的文件清单，用于判断哪些文件在新版本里被删掉了。
 * 优先读上次更新写下的本地清单；没有清单（第一次用 momo update 的项目）时，
 * 退回读取当前版本 tag 在 GitHub 上的文件树（一次轻量 API 调用，不下载文件内容）。
 */
async function previousTemplateFiles({ repo, version, releases = [], token, plan, onStatus }) {
  const manifest = await readJson(fromRoot(MANIFEST_FILE), null)
  if (Array.isArray(manifest?.files) && manifest.files.length) {
    // commit 模式的清单记的是分支 + SHA，没有版本号可说
    const label = manifest.sha
      ? `本地清单（${manifest.ref ?? 'commit'} @ ${String(manifest.sha).slice(0, 7)}）`
      : `本地清单（${manifest.tag ?? manifest.version ?? '未知版本'}）`
    return { files: manifest.files, label, truncated: false }
  }

  if (!version) return { files: [], label: null, truncated: false }

  // 优先用 Release 列表里的正式标签，其次按常见写法猜 tag
  const candidates = []
  const hit = releases.find((item) => String(item.version) === String(version))
  if (hit) candidates.push(hit.tag)
  candidates.push(`v${version}`, String(version))

  for (const ref of [...new Set(candidates)]) {
    try {
      const { files, truncated } = await listTreeFiles({ repo, ref, token, plan, onStatus })
      if (files.length) return { files, label: `远端文件树（${ref}）`, truncated }
    } catch {
      // 该 ref 不存在或接口不可用：换下一个候选，全部失败时按「没有清单」处理
    }
  }
  return { files: [], label: null, truncated: false }
}

/** 记下本次更新后源码里的文件清单，供下次更新判断删除 */
async function writeManifest({ repo, kind = 'release', tag = null, ref = null, sha = null, version, files }) {
  await writeJson(fromRoot(MANIFEST_FILE), {
    tool: 'momo',
    repo,
    kind,
    tag,
    ref,
    sha,
    version,
    updatedAt: new Date().toISOString(),
    files,
  })
}

export default {
  name: 'update',
  summary: '从 GitHub Release（或指定 commit）更新模板代码（保留自己的文章与图片）',
  usage:
    'pnpm momo update [--check] [--dry-run] [--version <标签>] [--commit <分支/标签/SHA>] [--keep <路径>] [--keep-config] [--no-delete]',
  details: [
    `数据源：默认对比 https://github.com/${DEFAULT_REPO}/releases 里的最新 Release，`
      + '用 package.json 的版本号判断是否需要更新（不需要本地 git）。',
    '加 --commit <分支/标签/SHA> 则改为同步某个提交的代码，例如 --commit main 取 main 的最新提交，',
    '也可以写 --commit v26.10.10 或 --commit 1a2b3c4；适合第一时间用上尚未发版的新代码。',
    'commit 模式先读远端文件树、与本地文件逐个算 blob 哈希比对，因此 --check / --dry-run 不用下载源码包，',
    '真正下载时也按解析出来的不可变 SHA 取包，并用这份哈希清单校验解压结果（镜像给了旧内容会自动换源）。',
    '解析分支名时会带一个时间戳绕开镜像的 API 缓存；如果解析出来的提交看起来偏旧，可以用 --mirror direct 再试一次。',
    '',
    '国内直连 GitHub 经常超时，因此下载 Release 列表与源码包时会先探测「GitHub 直连 + 公共镜像」，',
    '按实测速度挑最快的源；连不上、超时或返回错误内容就自动换下一个（每个源还会换几种 URL 形式），',
    '上次成功的源记在 .momo/mirror.json 里，一小时内直接复用。全部失败时会列出每个源的失败原因。',
    `内置镜像：${BUILTIN_MIRRORS.map((source) => source.name).join('、')}`,
    '用 --mirror <镜像前缀>（可逗号分隔多个）或环境变量 MOMO_MIRROR 指定镜像；--mirror direct 强制只走直连。',
    '经第三方镜像请求源码包时不会携带 GITHUB_TOKEN（token 只发给 GitHub 直连），介意的话请用 --mirror direct。',
    '',
    '更新时保留用户自己的内容：',
    `  ${[...CONTENT_PATHS, ...USER_CONFIG_PATHS].join('、')}`,
    `以下目录永远不更新（保留你自己的仓库配置）：${REPO_SKIP.join('、')}`,
    '其余文件按源码包覆盖（新增 + 修改 + 删除）；被覆盖或被删除的旧文件备份到 .backup/update-<时间戳>/overwritten/，配置文件另有一份完整备份。',
    '只差行尾（Windows 检出的 CRLF 与仓库里的 LF）不算修改，不会为了行尾重写文件。',
    '删除只针对「上一版模板里有、新版本已移除」的文件：依据上次更新写下的 .momo/manifest.json，',
    '第一次更新时改为读取当前版本 tag 的文件树，你自己新增的文件不在任何清单里，不会被删除。',
    '没有把握时可以先执行 pnpm momo update --dry-run 预览，或用 --no-delete 只覆盖不删除。',
  ].join('\n'),
  options: {
    check: { type: 'boolean', desc: '只检查是否有新版本，不下载（commit 模式还会列出会改动哪些文件）' },
    'dry-run': { type: 'boolean', desc: '下载并列出将要变更的文件，但不写入任何文件' },
    version: { type: 'string', desc: '更新到指定 Release 版本（标签，如 v26.9.26）' },
    commit: { type: 'string', desc: '改为同步某个 commit 的代码：分支名 / 标签 / commit SHA，如 --commit main' },
    repo: { type: 'string', desc: `数据源仓库，默认 ${DEFAULT_REPO}（也可用环境变量 MOMO_REPO）` },
    mirror: { type: 'string', desc: '下载源：auto（默认）/ direct（只用直连）/ <镜像前缀>（也可用环境变量 MOMO_MIRROR）' },
    keep: { type: 'string', desc: '额外保留的路径，逗号分隔，如 src/components/Header.astro' },
    'keep-config': { type: 'boolean', desc: '保留全部配置文件，只更新代码与文档（自己按说明合并配置）' },
    delete: { type: 'boolean', default: true, desc: '删除源码中已移除的旧文件（--no-delete 保留它们）' },
    backup: { type: 'boolean', default: true, desc: '更新前备份配置与被覆盖的文件（--no-backup 关闭）' },
    install: { type: 'boolean', default: true, desc: '更新后自动 pnpm install（--no-install 关闭）' },
    yes: { alias: 'y', type: 'boolean', desc: '跳过确认' },
  },

  async run({ flags }) {
    const repo = flags.repo || process.env.MOMO_REPO || DEFAULT_REPO
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    const localVersion = (await readJson(fromRoot('package.json'), {}))?.version ?? null

    // 数据源：默认最新 Release；--commit 时改为某个分支 / 标签 / commit 的最新代码
    const commitRef = flags.commit ? String(flags.commit).trim() : null
    if (flags.commit !== undefined && !commitRef) {
      fail('--commit 需要一个值：分支名 / 标签 / commit SHA，如 --commit main')
    }
    if (commitRef && flags.version) {
      fail('--commit 与 --version 不能同时使用：--version 指定 Release 标签，--commit 从分支 / 标签 / commit 同步代码')
    }

    // 下载源：auto（默认，探测后挑最快的）/ direct / 自定义镜像前缀
    const mirror = flags.mirror || process.env.MOMO_MIRROR || 'auto'
    /** 状态行统一走这里：先擦掉进度行，避免两条输出叠在一起；连续重复的状态只打一次 */
    let lastStatus = null
    const status = (text) => {
      if (text === lastStatus) return
      lastStatus = text
      log.progressEnd()
      log.step(text)
    }
    const sourcePlan = createSourcePlan({ mirror, onStatus: status })

    log.title(commitRef ? '检查更新（从 commit 同步）' : '检查更新')
    log.info(`数据源：${c.cyan(commitRef ? `https://github.com/${repo}/commits/${commitRef}` : `https://github.com/${repo}/releases`)}`)
    log.info(`本地版本：${c.bold(localVersion ?? '未知')}`)
    log.info(`下载源：${describeMirror(sourcePlan.mode)}`)

    // 保留用户自己的内容（两种模式共用）
    const keep = [...DEFAULT_KEEP]
    if (flags['keep-config']) keep.push(...CONFIG_PATHS)
    if (flags.keep) {
      keep.push(
        ...String(flags.keep)
          .split(',')
          .map((item) => item.trim().replace(/^\.?[\\/]/, ''))
          .filter(Boolean),
      )
    }

    let release = null // release 模式：目标 Release
    let commit = null // commit 模式：远端提交
    let remote = null // commit 模式：远端文件树（含每个文件的 blob 哈希）
    let previous = null // 上一版模板的文件清单（判断删除的依据）
    let releases = []
    let pending = [] // release 模式：本次跨过的版本（用于打印更新说明）

    if (commitRef) {
      // ---- commit 模式：解析 ref → 比对远端文件树与本地文件哈希，不用下载源码包就能给出结论 ----
      log.raw()
      log.step(`解析 ${commitRef} …`)
      commit = await resolveCommit({ repo, ref: commitRef, token, plan: sourcePlan, onStatus: status })
      log.ok(
        `远端提交 ${c.bold(commit.shortSha)}` + c.gray(`（${commit.ref}${commit.date ? `，${fmtDate(commit.date)} 提交` : ''}）`),
      )
      if (commit.subject) log.info(c.gray(commit.subject))

      previous = await previousTemplateFiles({ repo, version: localVersion, token, plan: sourcePlan, onStatus: status })
      const tree = await fetchTree({ repo, ref: commit.sha, token, plan: sourcePlan, onStatus: status })
      remote = tree.entries
      const compared = await compareTree(remote, {
        root: fromRoot('.'),
        preserve: keep,
        skip: ALWAYS_SKIP,
        previous: previous.files,
      })

      const plannedWrites = compared.added.length + compared.modified.length
      const plannedRemovals = flags.delete ? compared.removed.length : 0
      // 文件树被 GitHub 截断时比对结果不完整，不能再据此下「已是最新」的结论
      const complete = !tree.truncated
      if (!complete) {
        log.warn('远端文件树被 GitHub 截断，本次比对可能漏掉个别文件，改为下载源码包后再确认变更')
      }

      if (flags.check) {
        showPreview(compared, { empty: `本地代码与 ${commit.shortSha} 完全一致` })
        log.raw()
        log.dim('（--check：只比对远端文件树与本地文件的哈希，未下载任何文件）')
        if (plannedWrites || plannedRemovals) {
          log.info(c.gray(`执行 pnpm momo update --commit ${commit.ref} 直接同步，或加 --dry-run 预览`))
        }
        return
      }

      if (complete && !plannedWrites && !plannedRemovals) {
        // 记下这次的提交与文件清单，供下次更新判断「哪些文件已被移除」；
        // --no-delete 保留下来的文件继续留在清单里，下次更新还会提醒你
        const files = flags.delete ? compared.files : [...new Set([...compared.files, ...compared.removed])].sort()
        await writeManifest({
          repo,
          kind: 'commit',
          ref: commit.ref,
          sha: commit.sha,
          version: localVersion,
          files,
        })
        log.raw()
        log.ok(`本地代码已与 ${commit.ref} 的最新提交一致（${c.bold(commit.shortSha)}），无需更新`)
        if (!flags.delete && compared.removed.length) {
          log.info(c.gray(`  （--no-delete：保留了 ${compared.removed.length} 个该提交中已移除的文件）`))
        }
        log.info(c.gray('需要已发布的版本时，请执行不带 --commit 的 pnpm momo update'))
        return
      }

      if (flags['dry-run'] && complete) {
        showPreview(compared)
        printPreviousInfo(previous)
        log.raw()
        log.dim('（--dry-run：只比对远端文件树，未下载或写入任何文件）')
        return
      }

      // 其余情况继续走下面的下载与写入流程（预览与写入都以解压出来的源码包为准）；
      // 文件树不完整时 --dry-run 也走这条路，好在预览是完整的
      if (complete && !plannedWrites) {
        log.raw()
        log.info(c.gray(`本地代码与该提交一致，只有 ${plannedRemovals} 个文件已被该提交移除`))
      }
    } else {
      // ---- release 模式：默认对比最新 Release ----
      releases = await listReleases({ repo, token, plan: sourcePlan, onStatus: status })
      const latest = releases[0] ?? null
      if (flags.version) {
        release = await findRelease({ repo, version: flags.version, releases, token, plan: sourcePlan, onStatus: status })
      } else if (latest && compareVersions(latest.version, localVersion ?? '0') > 0) {
        release = latest
      }

      if (!release) {
        log.raw()
        if (!latest) {
          log.ok('远端还没有发布任何 Release')
          log.info(c.gray('可以直接用 pnpm momo update --commit main 从代码仓库同步最新代码'))
        } else if (!flags.version && compareVersions(localVersion ?? '0', latest.version) > 0) {
          log.ok(`本地版本 ${c.bold(localVersion)} 高于最新 Release ${c.bold(latest.tag)}，没有需要更新的发布版本`)
          log.info(c.gray('想和代码仓库对齐时，可用 pnpm momo update --commit main 同步最新提交'))
        } else {
          log.ok(
            `已是最新版本（最新 release：${c.bold(latest.tag)}${c.gray(fmtDate(latest.publishedAt) ? `，${fmtDate(latest.publishedAt)}` : '')}）`,
          )
          log.info(c.gray('想用上尚未发版的最新代码时，可用 pnpm momo update --commit main'))
          log.info(c.gray('也可以用 --version <标签> 指定版本，或 --dry-run 预览变更'))
        }
        return
      }

      const knownTarget = releases.some((item) => item.tag === release.tag)
      const newer = releases
        .filter((item) => compareVersions(item.version, localVersion ?? '0') > 0)
        .sort((a, b) => compareVersions(a.version, b.version))
      // 只有目标本身就是 Release 时才能列出「跨过的版本」，否则只提示目标版本
      pending = knownTarget ? newer.filter((item) => compareVersions(item.version, release.version) <= 0) : []
      if (!pending.length) pending.push(release)

      const isDowngrade = compareVersions(release.version, localVersion ?? '0') <= 0 && Boolean(flags.version)
      log.raw()
      if (isDowngrade) {
        log.warn(`指定版本 ${c.bold(release.tag)} 不高于本地版本 ${c.bold(localVersion ?? '未知')}，将按你的要求覆盖`)
      } else {
        log.ok(
          `${c.bold(localVersion ?? '未知')} → ${c.bold(release.version)}` +
            c.gray(`（${release.tag}${release.publishedAt ? `，${fmtDate(release.publishedAt)} 发布` : ''}）`),
        )
      }
      if (!knownTarget) {
        log.info(c.gray(`Release 列表里没有 ${release.tag}，将直接下载该标签的源码（没有更新说明）`))
      } else if (pending.length > 1) {
        log.info(`跨越 ${pending.length} 个版本：${pending.map((item) => item.tag).join(' → ')}`)
      }

      if (flags.check) {
        log.raw()
        log.dim('（--check：只检查版本，未下载任何文件）')
        log.info(c.gray('执行 pnpm momo update 直接更新，或用 pnpm momo update --dry-run 预览变更'))
        log.info(c.gray('想用上尚未发版的最新代码时，可用 pnpm momo update --commit main'))
        return
      }

      // 上一版模板的文件清单：用于判断新版本删掉了哪些文件
      previous = await previousTemplateFiles({ repo, version: localVersion, releases, token, plan: sourcePlan, onStatus: status })
    }

    // 1) 下载并解压源码：release 按标签，commit 按解析出来的不可变 SHA
    const target = commit
      ? { kind: 'commit', ref: commit.sha, tag: null, version: null, label: `${commit.shortSha}（${commit.ref}）` }
      : { kind: 'release', ref: release.tag, tag: release.tag, version: release.version, label: release.tag }

    const dir = join(tmpdir(), `momo-update-${Date.now()}`)
    await ensureDir(dir)
    let source
    try {
      log.raw()
      source = await downloadRelease({
        target,
        repo,
        token,
        dir,
        plan: sourcePlan,
        onStatus: status,
        onProgress: progressReporter(),
        // commit 模式：解压结果必须与远端文件树逐个哈希一致，镜像给了旧内容就自动换源
        verify: commit ? (extracted) => verifyTree(extracted, remote) : undefined,
      })
      log.progressEnd()
    } catch (error) {
      log.progressEnd()
      await rm(dir, { recursive: true, force: true })
      throw error
    }

    if (release && source.version && compareVersions(source.version, release.version) !== 0) {
      await rm(dir, { recursive: true, force: true })
      fail(`源码包里的版本（${source.version}）与标签（${release.tag}）不一致，可能下载到了错误的分支，请稍后重试`)
    }
    if (source.source !== DIRECT_SOURCE.name) {
      log.info(c.gray(`  下载源：${source.source}（自定义镜像可用 --mirror <前缀> 或环境变量 MOMO_MIRROR）`))
    }
    if (commit && source.version) {
      const advanced = compareVersions(source.version, localVersion ?? '0') > 0
      log.info(c.gray(`  ${commit.shortSha} 的 package.json 版本：${source.version}${advanced ? '（高于本地版本）' : ''}`))
    }

    // 2) 生成变更清单（保留用户内容）
    const plan = await planChanges(dir, {
      root: fromRoot('.'),
      preserve: keep,
      skip: ALWAYS_SKIP,
      previous: previous.files,
    })
    const writes = [...plan.added, ...plan.modified]
    // --no-delete 时只在预览里列出，不真正删除
    const removals = flags.delete ? plan.removed : []
    const keptRemovals = flags.delete ? [] : plan.removed

    showPreview(plan, {
      empty: commit ? '没有需要改动的文件（本地代码与该提交一致）' : '没有需要改动的文件（本地内容与 release 一致）',
    })

    log.raw()
    printPreviousInfo(previous)
    if (keptRemovals.length) {
      log.warn(
        `已按 --no-delete 保留 ${keptRemovals.length} 个源码中已移除的文件（下次更新仍会再次提示，想永久保留请用 --keep <路径>）`,
      )
    }

    log.info(`保留自己的文件：${c.gray(keep.join('、'))}`)
    if (plan.preserved.length) {
      log.info(c.gray(`  （源码包里有 ${plan.preserved.length} 个同名文件被跳过，属于你自己的内容）`))
    }
    log.info(c.gray(`不参与更新的目录：${[...REPO_SKIP, '.momo'].join('、')}`))

    const configChanged = writes.filter((file) => CONFIG_PATHS.some((p) => file === p || file.startsWith(`${p}/`)))
    if (configChanged.length) {
      log.raw()
      log.warn(`本次更新改动了 ${configChanged.length} 个配置文件，更新后请按更新说明检查是否需要手工合并：`)
      for (const file of configChanged) log.info(`  ${c.yellow('•')} ${file}`)
    }

    if (flags['dry-run']) {
      await rm(dir, { recursive: true, force: true })
      log.raw()
      log.dim('（--dry-run：未写入任何文件）')
      return
    }

    // 本次要写进清单的文件：源码包的文件列表；--no-delete 保留下来的文件继续留在清单里，
    // 这样下次更新还会把它们列出来提醒你，而不是悄悄变成「你自己的文件」
    const manifestFiles = keptRemovals.length
      ? [...new Set([...plan.files, ...keptRemovals])].sort()
      : plan.files
    const manifest = {
      repo,
      kind: commit ? 'commit' : 'release',
      tag: release?.tag ?? null,
      ref: commit?.ref ?? null,
      sha: commit?.sha ?? null,
      version: source.version ?? release?.version ?? null,
      files: manifestFiles,
    }

    if (!writes.length && !removals.length) {
      await writeManifest(manifest)
      await rm(dir, { recursive: true, force: true })
      log.raw()
      log.ok(keptRemovals.length ? `代码已是最新（已保留 ${keptRemovals.length} 个已移除的文件）` : '代码已是最新，无需写入')
      return
    }

    // 3) 确认
    log.progressEnd()
    if (!flags.yes) {
      log.raw()
      const todo = [`写入 ${writes.length} 个文件`]
      if (removals.length) todo.push(`删除 ${removals.length} 个文件`)
      const from = commit ? `本地代码 / ${commit.shortSha}` : `${localVersion ?? '未知'} → ${release.version}`
      const ok = await confirm(`确认${todo.join('、')}（${from}）？`, { default: true })
      if (!ok) {
        await rm(dir, { recursive: true, force: true })
        log.dim('已取消')
        return
      }
    }

    // 4) 备份：配置文件走 backup 命令，被覆盖 / 被删除的文件另存到同一个备份目录下
    let backupName = null
    if (flags.backup) {
      log.raw()
      backupName = await nextBackupName()
      const backupDir = join(fromRoot(BACKUP_DIR), backupName)

      log.step('备份配置文件…')
      await backupCommand.run({ flags: { all: false, config: true, list: false, name: backupName, out: undefined } })

      const risky = [...writes, ...removals]
      log.step(`备份将被覆盖或删除的 ${risky.length} 个文件…`)
      for (const file of risky) {
        if (!(await pathExists(fromRoot(file)))) continue // 新增文件无需备份
        await copyPath(fromRoot(file), join(backupDir, 'overwritten', ...file.split('/')))
      }
      await writeJson(join(backupDir, 'update.json'), {
        tool: 'momo',
        createdAt: new Date().toISOString(),
        repo,
        kind: manifest.kind,
        from: localVersion,
        to: commit ? commit.sha : release.version,
        tag: release?.tag ?? null,
        commit: commit ? { ref: commit.ref, sha: commit.sha } : null,
        preservedPaths: keep,
        previousFiles: previous.label,
        added: plan.added,
        modified: plan.modified,
        removed: plan.removed,
      })
      log.ok(`已备份到 ${c.bold(relPath(backupDir))}`)
    } else {
      log.raw()
      log.warn('已跳过备份（--no-backup），被覆盖或被删除的文件无法通过 pnpm momo restore 找回')
    }

    // 5) 写入文件
    log.raw()
    log.step(`写入 ${writes.length} 个文件…`)
    for (const file of writes) {
      await copyPath(join(dir, ...file.split('/')), fromRoot(file))
    }

    // 5.1) 删除源码中已移除的旧文件（只删上面认定的模板文件）
    if (removals.length) {
      log.step(`删除 ${removals.length} 个源码中已移除的文件…`)
      for (const file of removals) await removePath(fromRoot(file))
      await pruneEmptyDirs(removals, fromRoot('.'))
      for (const file of removals.slice(0, LIST_LIMIT)) log.info(`  ${c.red('•')} ${file}`)
      if (removals.length > LIST_LIMIT) log.info(c.gray(`  …还有 ${removals.length - LIST_LIMIT} 个`))
    }

    // 记下本次的文件清单，供下次更新判断删除
    await writeManifest(manifest)
    await rm(dir, { recursive: true, force: true })
    log.ok(commit ? `代码已同步到 ${c.bold(commit.shortSha)}（${commit.ref}）` : `代码已更新到 ${c.bold(release.version)}`)

    // 6) 同步依赖
    if (flags.install) {
      log.raw()
      log.step('安装依赖…')
      runPnpm(['install'])
      log.ok('依赖已同步')
    } else {
      log.raw()
      log.warn('已跳过 pnpm install（--no-install），依赖可能不一致')
    }

    // 7) 更新说明：release 用 release 自带说明 / 本地更新指南，commit 则只在版本号前进时才有说明
    const localNotes = await readFile(fromRoot('doc/release_zh-cn.md'), 'utf8').catch(() => null)
    const sections = []
    if (commit) {
      const version = source.version
      if (version && compareVersions(version, localVersion ?? '0') > 0) {
        const text = notesFrom(localNotes, version)
        if (text) sections.push({ version, text })
      }
    } else {
      for (const item of pending) {
        const text = item.body || notesFrom(localNotes, item.version)
        if (text) sections.push({ version: item.version, text })
      }
    }
    if (sections.length) {
      log.raw()
      log.title('更新说明')
      for (const section of sections) {
        log.raw(c.bold(`### ${section.version}`))
        log.raw(section.text)
        log.raw()
      }
    }

    if (gitInfo()?.dirty) log.info(c.gray('工作区有未提交改动，可用 git diff 查看本次更新带来的变化'))

    log.raw()
    if (commit) {
      log.ok(`同步完成：已对齐 ${c.bold(commit.ref)} 的提交 ${c.bold(commit.shortSha)}`)
      log.info(c.gray('本次同步的是代码仓库的提交，不是正式 Release，遇到问题可用 pnpm momo restore <备份名> 回滚配置'))
    } else {
      log.ok(`更新完成：${localVersion ?? '未知'} → ${release.version}`)
    }
    if (backupName) log.info(c.gray(`回滚配置：pnpm momo restore ${backupName}`))
    if (backupName && removals.length) {
      log.info(c.gray(`已删除的 ${removals.length} 个文件也备份在 .backup/${backupName}/overwritten/ 下，需要时可以手动复制回来`))
    }
    log.info(c.gray('建议执行 pnpm build 验证构建，或 pnpm dev 本地预览'))
  },
}
