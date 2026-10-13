// release.js — momo update 的数据源：从 GitHub Release 或某个 commit 获取模板新代码
//
// 设计要点：
// - 不依赖本地 git 仓库，直接读 https://github.com/<repo>/releases（版本对比）与源码包；
//   也可以按分支 / 标签 / commit SHA 同步（`--commit`），此时按不可变的 SHA 下载，
//   并先用 git/trees 拿到的 blob 哈希与本地文件比对，不下载源码包就能判断是否需要更新；
// - 只使用 Node 内置模块（全局 fetch / node:zlib），下载 tar.gz 后自己解析 tar（不引入解压依赖）；
// - 访问 GitHub 时优先走「自动探测出来的最快镜像」（见 mirrors.js），直连不可用也能更新；
// - 解压出来的文件先落到临时目录，再由 update 命令比对、保留用户内容后逐个覆盖。
//
// 仓库默认取 Motues/Momo，可用环境变量 MOMO_REPO 或 --repo 覆盖（便于测试或使用自己的 fork）；
// 下载源用 --mirror / MOMO_MIRROR 指定（默认 auto：直连 + 公共镜像里自动选最快的）。
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SourceError, DIRECT_SOURCE, createSourcePlan, fetchFile, isGzip, looksLikeArchive } from './mirrors.js'

const gunzipAsync = promisify(gunzip)

export const DEFAULT_REPO = 'Motues/Momo'
const BLOCK = 512
const API_ROOT = 'https://api.github.com'

/** GitHub 直连请求头：只有直连才带 token（第三方镜像绝不能拿到用户的 token） */
function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'momo-cli',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const auth = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (auth) headers.Authorization = `Bearer ${auth}`
  return headers
}

/** 走镜像的请求头：不带 Authorization，也不带 api 版本号（部分镜像不认） */
function mirrorHeaders() {
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'momo-cli' }
}

/** 出错时列出尝试过的源，并给出可操作的建议 */
function allSourcesFailed(what, errors) {
  const lines = errors.map((item) => `  - ${item}`)
  return new Error(
    `${what}，已尝试 ${errors.length} 个下载源：\n${lines.join('\n')}\n` +
      '请检查网络或代理；也可以用 --mirror <镜像前缀> 指定镜像（例如 --mirror https://gh-proxy.com/），\n' +
      '或设 MOMO_MIRROR 环境变量；--mirror direct 则强制只用 GitHub 直连',
  )
}

/**
 * 请求 GitHub API（会自动换源）。
 * @param {string} path API 路径，如 /repos/owner/name/releases
 * @param {{token?: string, plan?: object, probeUrl?: string, onStatus?: Function}} options
 */
async function apiGet(path, { token, plan, probeUrl, onStatus = () => {} } = {}) {
  const target = `${API_ROOT}${path}`
  const planner = plan ?? createSourcePlan({ onStatus })
  const probe = probeUrl ?? `${API_ROOT}/repos/${DEFAULT_REPO}/releases?per_page=1`
  const errors = []

  /** 依次尝试若干源；stopEarly 表示这批顺序来自缓存、不可靠，失败一次就先回去重新探测 */
  const trySources = async (sources, stopEarly) => {
    for (const source of sources) {
      const url = source.prefix + target
      try {
        const { buffer } = await fetchFile(url, {
          headers: source.direct ? githubHeaders(token) : mirrorHeaders(),
          idleTimeout: 20000,
          totalTimeout: 60000,
          expect: 'json',
        })
        let data
        try {
          data = JSON.parse(buffer.toString('utf8'))
        } catch {
          throw new SourceError('返回的不是 JSON（镜像可能已失效）', { kind: 'content' })
        }
        if (!data || typeof data !== 'object') throw new SourceError('返回的不是 JSON', { kind: 'content' })
        if (!source.direct) {
          onStatus(`GitHub API 经由镜像 ${source.name}`)
          await planner.remember('api', source)
        }
        return data
      } catch (error) {
        const note = error instanceof Error ? error.message : String(error)
        errors.push(`${source.name}：${note}`)
        onStatus(`${source.name} 不可用（${note}），换下一个源…`)
        if (stopEarly) return null
      }
    }
    return null
  }

  const first = await planner.order('api', probe)
  const hit = await trySources(first.sources, !first.probed)
  if (hit) return hit

  if (!first.probed) {
    onStatus('上次记录的源不可用，重新探测…')
    const refreshed = await planner.order('api', probe, { refresh: true })
    const retry = await trySources(refreshed.sources, false)
    if (retry) return retry
  }
  throw allSourcesFailed('访问 GitHub API 失败', errors)
}

/** 版本号 → 数字数组，便于比较（26.9.26 > 26.9.10；支持 v 前缀与额外后缀） */
export function parseVersion(value) {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(value ?? ''))
  if (!match) return null
  return [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

/** a > b 返回正数，a < b 返回负数，相等返回 0 */
export function compareVersions(a, b) {
  const left = parseVersion(a) ?? [0, 0, 0]
  const right = parseVersion(b) ?? [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return 0
}

/** 拉取 Release 列表（按版本从新到旧） */
export async function listReleases({ repo = DEFAULT_REPO, token, perPage = 30, plan, onStatus } = {}) {
  const probeUrl = `${API_ROOT}/repos/${repo}/releases?per_page=1`
  const data = await apiGet(`/repos/${repo}/releases?per_page=${perPage}`, { token, plan, probeUrl, onStatus })
  if (!Array.isArray(data)) throw new Error(`无法解析 ${repo} 的 Release 列表`)
  return data
    .filter((item) => !item.draft)
    .map((item) => ({
      tag: item.tag_name,
      version: String(item.tag_name).replace(/^v/i, ''),
      name: item.name || item.tag_name,
      body: (item.body || '').trim(),
      prerelease: Boolean(item.prerelease),
      publishedAt: item.published_at || item.created_at || null,
      tarballUrl: item.tarball_url || `${API_ROOT}/repos/${repo}/tarball/${item.tag_name}`,
    }))
    .sort((a, b) => compareVersions(b.version, a.version))
}

/** 按标签取单个 Release；不存在时返回一个「只有 tag」的占位对象（仍可下载该 tag 的源码） */
export async function findRelease({ repo = DEFAULT_REPO, version, releases, token, plan, onStatus } = {}) {
  const wanted = String(version).trim()
  const list = releases ?? (await listReleases({ repo, token, plan, onStatus }))
  const hit = list.find(
    (item) => item.tag === wanted || item.version === wanted.replace(/^v/i, '') || item.tag === `v${wanted.replace(/^v/i, '')}`,
  )
  if (hit) return hit
  const tag = /^v/i.test(wanted) ? wanted : `v${wanted}`
  // 不是 Release（例如只有 tag）时仍允许更新，只是没有更新说明
  return {
    tag,
    version: tag.replace(/^v/i, ''),
    name: tag,
    body: '',
    prerelease: false,
    publishedAt: null,
    tarballUrl: `${API_ROOT}/repos/${repo}/tarball/${tag}`,
  }
}

/**
 * 拉取某个 ref（tag / 分支 / commit SHA）下的文件树。
 * git/trees 一次就能拿到全部路径与每个文件的 blob 哈希（不下载文件内容），因此既能用来
 * 推断「上一版模板有哪些文件」，也能和本地文件的哈希逐个比对来判断是否需要更新。
 *
 * @returns {Promise<{entries: {path: string, sha: string, size: number}[], files: string[], truncated: boolean, sha: string|null}>}
 */
export async function fetchTree({ repo = DEFAULT_REPO, ref, token, plan, onStatus } = {}) {
  const probeUrl = `${API_ROOT}/repos/${repo}/releases?per_page=1`
  const data = await apiGet(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { token, plan, probeUrl, onStatus })
  const entries = (Array.isArray(data?.tree) ? data.tree : [])
    .filter((item) => item.type === 'blob' && item.path)
    .map((item) => ({ path: item.path, sha: item.sha, size: Number(item.size) || 0 }))
  return { entries, files: entries.map((item) => item.path), truncated: Boolean(data?.truncated), sha: data?.sha ?? null }
}

/** 只取文件名清单（见 fetchTree） */
export async function listTreeFiles(options) {
  const { files, truncated } = await fetchTree(options)
  return { files, truncated }
}

/**
 * 把 ref（分支名 / 标签 / 完整或短 commit SHA）解析成一个具体的提交。
 * 用于 `momo update --commit <ref>`：分支名会解析成它当前的最新提交，
 * 之后一律按这个不可变的 SHA 下载源码包，避免「比对与下载之间分支又前进了」。
 *
 * ⚠️ 这里带一个每次都变的时间戳：公共镜像普遍会缓存 API 响应（实测刚推送完，
 * gh.catmak.name 仍然回上一次的 SHA），而分支名要的恰恰是「此刻的最新提交」。
 * GitHub 会忽略不认识的查询参数，所以加了也不影响直连。
 *
 * @returns {Promise<{ref: string, sha: string, shortSha: string, subject: string, date: string|null, htmlUrl: string}>}
 */
export async function resolveCommit({ repo = DEFAULT_REPO, ref, token, plan, onStatus } = {}) {
  const probeUrl = `${API_ROOT}/repos/${repo}/releases?per_page=1`
  const path = `/repos/${repo}/commits/${encodeURIComponent(ref)}?momo=${Date.now()}`
  let data
  try {
    data = await apiGet(path, { token, plan, probeUrl, onStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // 所有源都回 404/422：不是网络问题，而是远端根本没有这个 ref（GH 对不存在的 ref 回 422）
    if (missingRef(message)) {
      throw new Error(
        `远端仓库 ${repo} 里找不到 ${ref}：请确认分支 / 标签名是否写对，或这个 commit 是否已经推送到 GitHub` +
          '（只存在于本地的提交无法同步）',
      )
    }
    throw error
  }
  if (!data?.sha) throw new Error(`无法解析 ${repo} 的 ${ref}，请确认分支 / 标签 / commit 是否存在`)
  return {
    ref: String(ref),
    sha: String(data.sha),
    shortSha: String(data.sha).slice(0, 7),
    subject: String(data.commit?.message ?? '').split('\n')[0].trim(),
    date: data.commit?.committer?.date ?? data.commit?.author?.date ?? null,
    htmlUrl: data.html_url ?? `https://github.com/${repo}/commit/${data.sha}`,
  }
}

/** 直连 GitHub 回了 404/422：说明不是网络问题，而是远端没有这个 ref（GH 对不存在的 ref 回 422） */
function missingRef(message) {
  const line = String(message)
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`- ${DIRECT_SOURCE.name}：`))
  return Boolean(line) && /HTTP (404|422)\b/.test(line)
}

// ---------------- tar 解析 ----------------

function readCString(buffer, start, length) {
  const slice = buffer.subarray(start, start + length)
  const nul = slice.indexOf(0)
  return slice.subarray(0, nul < 0 ? slice.length : nul).toString('utf8')
}

function paxPath(text) {
  const match = /(?:^|\n)\d+ path=([^\n]+)/.exec(text)
  return match ? match[1] : null
}

/** 迭代 tar 条目（支持 ustar 前缀字段、GNU 长文件名与 PAX 头） */
export function* iterateTar(tar) {
  let offset = 0
  let pendingName = null

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK)
    // 全 0 块表示归档结束
    if (header.every((byte) => byte === 0)) break

    const name = readCString(header, 0, 100)
    const sizeField = readCString(header, 124, 12).trim()
    const size = sizeField ? Number.parseInt(sizeField, 8) || 0 : 0
    const type = String.fromCharCode(header[156] || 48)
    const prefix = readCString(header, 345, 155)
    const dataStart = offset + BLOCK
    const data = tar.subarray(dataStart, dataStart + size)
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK

    if (type === 'L') {
      pendingName = data.toString('utf8').replace(/\0+$/, '')
      continue
    }
    if (type === 'x' || type === 'g') {
      if (type === 'x') pendingName = paxPath(data.toString('utf8')) ?? pendingName
      continue
    }

    const raw = pendingName ?? (prefix ? `${prefix}/${name}` : name)
    pendingName = null
    yield { path: raw, size, type, data }
  }
}

/** 归档内的相对路径：去掉顶层目录，拒绝绝对路径与 ..（防止写出到项目外） */
export function safeRelPath(path) {
  const parts = String(path).split('/').filter((part) => part && part !== '.')
  if (!parts.length) return null
  if (/^[a-zA-Z]:$/.test(parts[0])) return null
  if (parts.some((part) => part === '..')) return null
  // 去掉 GitHub 归档的顶层目录（例如 Motues-Momo-<sha>/）
  return parts.slice(1).join('/') || null
}

const isPlainFile = (type) => type === '0' || type === '\0' || type === ''

/** 先扫一遍归档里的 package.json：拿版本号，也顺便确认这确实是本仓库的源码包 */
function readArchiveVersion(tar) {
  for (const entry of iterateTar(tar)) {
    if (!isPlainFile(entry.type)) continue
    if (safeRelPath(entry.path) !== 'package.json') continue
    try {
      return JSON.parse(entry.data.toString('utf8')).version ?? null
    } catch {
      return null
    }
  }
  return null
}

/** 把 tar 解压到 dir（校验在前，不会留下半个源码包） */
async function extractTar(tar, dir) {
  let files = 0
  let bytes = 0

  for (const entry of iterateTar(tar)) {
    if (!isPlainFile(entry.type)) continue // 只要普通文件
    const rel = safeRelPath(entry.path)
    if (!rel) continue
    const target = join(dir, ...rel.split('/'))
    if (!target.startsWith(dir)) continue
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, entry.data)
    files += 1
    bytes += entry.size
  }
  return { files, bytes }
}

/**
 * 源码包的几种下载地址（同一个源依次尝试）：
 * 1. github.com/<repo>/archive/... —— 公开镜像普遍支持，也是探测用的地址
 * 2. codeload.github.com/... —— 直连与部分镜像只认这个
 * 3. api.github.com/repos/.../tarball/... —— Release 接口给的原始地址
 *
 * target.kind === 'commit' 时 ref 是不可变的 commit SHA（不加 refs/tags 前缀）；
 * 否则按标签取包，先试镜像支持最广的 refs/tags 形式，再退回通用形式。
 */
function archiveForms(source, repo, target) {
  const ref = encodeURIComponent(target.ref)
  const generic = [
    `${source.prefix}https://github.com/${repo}/archive/${ref}.tar.gz`,
    `${source.prefix}https://codeload.github.com/${repo}/tar.gz/${ref}`,
    `${source.prefix}${API_ROOT}/repos/${repo}/tarball/${ref}`,
  ]
  if (target.kind === 'commit') return generic
  return [
    `${source.prefix}https://github.com/${repo}/archive/refs/tags/${ref}.tar.gz`,
    `${source.prefix}https://codeload.github.com/${repo}/tar.gz/refs/tags/${ref}`,
    ...generic,
  ]
}

/**
 * 下载 release（或某个 commit）的源码包并解压到 dir。
 * 会自动选择可用的镜像：先按一小时内的记录（没有则先探测），失败就换下一个源、
 * 再试同源的备用地址；沿用缓存失败时立刻重新探测一遍，仍失败才报错。
 *
 * @param {{kind?: 'release'|'commit', ref: string, tag?: string|null, version?: string|null, label?: string}} target
 *   要下载的目标：release 模式传标签，commit 模式传 SHA（见 update 命令）
 * @param {(dir: string) => Promise<string|null>} [verify]
 *   解压后的额外校验：返回一段问题描述即视为内容不可信，自动换下一个源（commit 模式用它核对文件哈希）
 * @returns {Promise<{files:number, bytes:number, version:string|null, source:string, url:string, ms:number}>}
 */
export async function downloadRelease({ target, repo = DEFAULT_REPO, token, dir, mirror, plan, onStatus = () => {}, onProgress, verify } = {}) {
  const planner = plan ?? createSourcePlan({ mirror, onStatus })
  const probeUrl = archiveForms({ prefix: '' }, repo, target)[0]
  const label = target.label ?? target.tag ?? target.ref
  const errors = []

  /** 依次尝试若干源（每个源再依次尝试几种 URL 形式）；stopEarly 见 apiGet 的说明 */
  const trySources = async (sources, stopEarly) => {
    onStatus(`下载 ${label} 源码包…`)
    for (const source of sources) {
      const forms = archiveForms(source, repo, target)
      for (let i = 0; i < forms.length; i++) {
        const url = forms[i]
        try {
          const { buffer, bytes, ms } = await fetchFile(url, {
            headers: source.direct ? githubHeaders(token) : mirrorHeaders(),
            onProgress,
          })
          if (!looksLikeArchive(buffer.subarray(0, 96))) throw new SourceError('内容不是源码包（镜像可能已失效）', { kind: 'content' })
          // 镜像若自己开了 gzip 压缩，fetch 已经解压过，所以按内容判断而不是按 URL
          const tar = isGzip(buffer) ? await gunzipAsync(buffer) : buffer
          const version = readArchiveVersion(tar)
          if (!version) throw new SourceError('源码包里没有 package.json（镜像返回了错误内容）', { kind: 'content' })

          const extracted = await extractTar(tar, dir)
          // 额外校验（commit 模式：解压结果必须与远端文件树逐个哈希一致）
          const problem = verify ? await verify(dir) : null
          if (problem) throw new SourceError(problem, { kind: 'content' })

          await writeFile(
            join(dir, '.momo-release.json'),
            `${JSON.stringify(
              {
                kind: target.kind ?? 'release',
                ref: target.ref,
                tag: target.tag ?? null,
                sha: target.kind === 'commit' ? target.ref : null,
                version,
                files: extracted.files,
                bytes: extracted.bytes,
                source: source.name,
              },
              null,
              2,
            )}\n`,
            'utf8',
          )
          if (!source.direct) await planner.remember('file', source)
          onStatus(
            `已下载 ${(bytes / 1024 / 1024).toFixed(1)} MB（${(ms / 1000).toFixed(1)} 秒）` +
              `，解压 ${extracted.files} 个文件（${(extracted.bytes / 1024 / 1024).toFixed(1)} MB）`,
          )
          return { files: extracted.files, bytes: extracted.bytes, version, source: source.name, url, ms }
        } catch (error) {
          const note = error instanceof Error ? error.message : String(error)
          errors.push(`${source.name}${i ? `（备用地址 ${i + 1}）` : ''}：${note}`)
          // HTTP 错误说明该地址不被这个镜像支持，换它的下一种形式；超时/网络错误直接换源
          const retryForm = error instanceof SourceError && error.kind === 'http' && i + 1 < forms.length
          if (retryForm) continue
          onStatus(`${source.name} 下载失败（${note}）${stopEarly ? '' : '，换下一个源…'}`)
          if (stopEarly) return null
          break
        }
      }
    }
    return null
  }

  const first = await planner.order('file', probeUrl)
  const hit = await trySources(first.sources, !first.probed)
  if (hit) return hit

  if (!first.probed) {
    onStatus('上次记录的源下载失败，重新探测最快的镜像…')
    const refreshed = await planner.order('file', probeUrl, { refresh: true })
    const retry = await trySources(refreshed.sources, false)
    if (retry) return retry
  } else {
    onStatus('所有下载源都失败了，可稍后重试或换一个镜像')
  }

  throw allSourcesFailed('下载源码包失败', errors)
}

// ---------------- 文件比对 ----------------

/** 路径是否命中保留列表（等于某项或位于其目录下） */
export function isPreserved(rel, preserve) {
  return preserve.some((entry) => rel === entry || rel.startsWith(`${entry}/`))
}

/**
 * 生成「哪些相对路径不参与更新」的判断函数（构建产物、仓库配置等）。
 * planChanges（读源码包目录）与 compareTree（读远端文件树）共用同一套规则，
 * 两条路径的结论才会一致。
 */
function makeSkipFilter(skip) {
  const set = new Set([...skip, '.momo-release.json'])
  return (rel) => {
    if (set.has(rel)) return true
    const parts = rel.split('/')
    parts.pop()
    return parts.some((part) => set.has(part))
  }
}

/** 把 CRLF 归一成 LF：Windows 检出（core.autocrlf=true）的工作区与仓库里的 LF 内容只差行尾 */
function normalizeEol(buffer) {
  return Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
}

/** 计算 git blob 哈希（与 `git hash-object` 一致）：sha1('blob <字节数>\0' + 内容) */
export function gitBlobHash(buffer, { normalize = false } = {}) {
  const data = normalize && buffer.includes(0x0d) ? normalizeEol(buffer) : buffer
  return createHash('sha1').update(`blob ${data.length}\u0000`, 'utf8').update(data).digest('hex')
}

/** 本地文件内容是否等于远端 blob（容忍只差 CRLF/LF 的情况） */
export function blobMatches(buffer, sha) {
  if (gitBlobHash(buffer) === sha) return true
  return buffer.includes(0x0d) && gitBlobHash(buffer, { normalize: true }) === sha
}

/** 两份内容是否一致（先比字节，再容忍行尾差异） */
export function sameContent(left, right) {
  if (left.equals(right)) return true
  if (!left.includes(0x0d) && !right.includes(0x0d)) return false
  return normalizeEol(left).equals(normalizeEol(right))
}

/** 列出目录下所有文件的相对路径（/ 分隔），跳过 skipDirs */
export async function collectFiles(dir, { skip = new Set() } = {}) {
  const out = []
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue
        await walk(full)
      } else if (entry.isFile()) {
        const rel = full.slice(dir.length + 1).split('\\').join('/')
        if (!skip.has(rel)) out.push(rel)
      }
    }
  }
  await walk(dir)
  return out
}

/**
 * 把远端文件树（fetchTree 的结果）与本地项目逐个文件比对。
 * 只读本地文件、逐个算哈希即可判断「新增 / 修改 / 相同 / 保留 / 删除」，不需要下载源码包。
 * 返回结构与 planChanges 一致，两者可以共用同一套打印逻辑。
 */
export async function compareTree(entries, { root, preserve = [], skip = [], previous = [] }) {
  const isSkipped = makeSkipFilter(skip)
  const added = []
  const modified = []
  const same = []
  const preserved = []
  const files = []

  for (const entry of entries) {
    const rel = entry.path
    if (isSkipped(rel)) continue
    files.push(rel)
    if (isPreserved(rel, preserve)) {
      preserved.push(rel)
      continue
    }
    const local = await readFile(join(root, ...rel.split('/'))).catch(() => null)
    if (!local) added.push(rel)
    else if (!blobMatches(local, entry.sha)) modified.push(rel)
    else same.push(rel)
  }
  files.sort()

  // 删除：与 planChanges 同一套规则，只删「上一版模板有、新版本没有」的普通文件
  const current = new Set(files)
  const removed = []
  for (const rel of previous) {
    if (current.has(rel)) continue
    if (rel.startsWith('/') || rel.split('/').includes('..')) continue
    if (isPreserved(rel, preserve)) continue
    if (isSkipped(rel)) continue
    if (!statSync(join(root, ...rel.split('/')), { throwIfNoEntry: false })?.isFile()) continue
    removed.push(rel)
  }
  removed.sort()

  return { added: added.sort(), modified: modified.sort(), same, preserved, removed, files, total: files.length }
}

/**
 * 校验解压出来的源码包：每个远端 blob 都要在解压目录里找到且哈希一致。
 * 用来挡住「镜像缓存了旧内容」「镜像返回了别的分支」这类问题——
 * 返回问题描述时下载会自动换下一个源。
 * @returns {Promise<string|null>} null 表示通过
 */
export async function verifyTree(dir, entries) {
  for (const entry of entries) {
    const buffer = await readFile(join(dir, ...entry.path.split('/'))).catch(() => null)
    if (!buffer) return `源码包里缺少 ${entry.path}`
    if (gitBlobHash(buffer) !== entry.sha) return `源码包里的 ${entry.path} 与远端内容不一致`
  }
  return null
}

/** 比对源码目录与项目目录，得到「新增 / 修改 / 保留 / 删除」四个清单 */
export async function planChanges(sourceDir, { root, preserve = [], skip = [], previous = [] }) {
  const skipSet = new Set([...skip, '.momo-release.json'])
  const paths = (await collectFiles(sourceDir, { skip: skipSet })).sort()
  const added = []
  const modified = []
  const same = []
  const preserved = []

  for (const rel of paths) {
    if (isPreserved(rel, preserve)) {
      preserved.push(rel)
      continue
    }
    const localPath = join(root, ...rel.split('/'))
    const sourceBuffer = await readFile(join(sourceDir, ...rel.split('/')))
    const localBuffer = await readFile(localPath).catch(() => null)
    if (!localBuffer) added.push(rel)
    // 只差行尾（Windows 检出的 CRLF）不算修改，避免每次更新都重写一批内容相同的文件
    else if (!sameContent(sourceBuffer, localBuffer)) modified.push(rel)
    else same.push(rel)
  }

  // 删除：只认 previous（上一版模板的文件清单）里有、而新版本已经移除的路径。
  // 用户自己新增的文件不在任何模板清单里，因此永远不会被这条规则删掉；
  // 保留目录（文章、图片、src/config.ts 等）与不参与更新的目录也一律跳过。
  const current = new Set(paths)
  const removed = []
  for (const rel of previous) {
    if (current.has(rel)) continue
    // 清单理论上只来自仓库，这里仍然挡一次越界路径
    if (rel.startsWith('/') || rel.split('/').includes('..')) continue
    if (isPreserved(rel, preserve)) continue
    if (skipSet.has(rel) || skipSet.has(rel.split('/')[0])) continue
    // 同名目录不动：只删模板留下的普通文件，避免把用户自己的目录整棵删掉
    if (!statSync(join(root, ...rel.split('/')), { throwIfNoEntry: false })?.isFile()) continue
    removed.push(rel)
  }
  removed.sort()

  return { added, modified, same, preserved, removed, files: paths, total: paths.length }
}
