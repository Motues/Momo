// release.js — momo update 的数据源：从 GitHub Release 获取模板新代码
//
// 设计要点：
// - 不依赖本地 git 仓库，直接读 https://github.com/<repo>/releases（版本对比）与 release 源码包；
// - 只使用 Node 内置模块（全局 fetch / node:zlib），下载 tar.gz 后自己解析 tar（不引入解压依赖）；
// - 解压出来的文件先落到临时目录，再由 update 命令比对、保留用户内容后逐个覆盖。
//
// 仓库默认取 Motues/Momo，可用环境变量 MOMO_REPO 或 --repo 覆盖（便于测试或使用自己的 fork）。
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const gunzipAsync = promisify(gunzip)

export const DEFAULT_REPO = 'Motues/Momo'
const BLOCK = 512
const API = 'https://api.github.com'

/** GitHub API 请求（带 UA / 可选 token / 超时），失败时抛出面向用户的错误 */
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

async function request(url, { token, raw = false, timeout = 60000 } = {}) {
  let response
  try {
    response = await fetch(url, {
      headers: githubHeaders(token),
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    })
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? '请求超时' : error?.message ?? String(error)
    throw new Error(`无法访问 ${url}（${reason}）\n请检查网络或代理设置；也可以设置 GITHUB_TOKEN 提高限额`)
  }
  if (response.status === 403 || response.status === 429) {
    throw new Error(`GitHub API 访问受限（HTTP ${response.status}），请稍后重试或设置 GITHUB_TOKEN 环境变量`)
  }
  if (response.status === 404) {
    throw new Error(`未找到资源：${url}\n请确认仓库/标签是否存在（可用 --repo 指定其他仓库）`)
  }
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）：${url}`)
  return raw ? Buffer.from(await response.arrayBuffer()) : response.json()
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
export async function listReleases({ repo = DEFAULT_REPO, token, perPage = 30 } = {}) {
  const data = await request(`${API}/repos/${repo}/releases?per_page=${perPage}`, { token })
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
      tarballUrl: item.tarball_url || `${API}/repos/${repo}/tarball/${item.tag_name}`,
    }))
    .sort((a, b) => compareVersions(b.version, a.version))
}

/** 按标签取单个 Release；不存在时返回一个「只有 tag」的占位对象（仍可下载该 tag 的源码） */
export async function findRelease({ repo = DEFAULT_REPO, version, releases, token } = {}) {
  const wanted = String(version).trim()
  const list = releases ?? (await listReleases({ repo, token }))
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
    tarballUrl: `${API}/repos/${repo}/tarball/${tag}`,
  }
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

/** 下载 release 源码包并解压到 dir（返回文件数、字节数与归档内的 package.json 版本） */
export async function downloadRelease({ release, token, dir, onStatus = () => {} }) {
  onStatus(`下载 ${release.tag} 源码包…`)
  const gz = await request(release.tarballUrl, { token, raw: true, timeout: 120000 })
  onStatus(`已下载 ${(gz.length / 1024 / 1024).toFixed(1)} MB，解压中…`)

  const tar = await gunzipAsync(gz)
  let files = 0
  let bytes = 0
  let version = null

  for (const entry of iterateTar(tar)) {
    if (entry.type !== '0' && entry.type !== '\0' && entry.type !== '') continue // 只要普通文件
    const rel = safeRelPath(entry.path)
    if (!rel) continue
    const target = join(dir, ...rel.split('/'))
    if (!target.startsWith(dir)) continue
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, entry.data)
    files += 1
    bytes += entry.size
    if (rel === 'package.json' && !version) {
      try {
        version = JSON.parse(entry.data.toString('utf8')).version ?? null
      } catch {
        version = null
      }
    }
  }

  await writeFile(join(dir, '.momo-release.json'), `${JSON.stringify({ tag: release.tag, version, files, bytes }, null, 2)}\n`, 'utf8')
  onStatus(`已解压 ${files} 个文件（${(bytes / 1024 / 1024).toFixed(1)} MB）`)
  return { files, bytes, version }
}

// ---------------- 文件比对 ----------------

/** 路径是否命中保留列表（等于某项或位于其目录下） */
export function isPreserved(rel, preserve) {
  return preserve.some((entry) => rel === entry || rel.startsWith(`${entry}/`))
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

/** 比对源码目录与项目目录，得到「新增 / 修改 / 保留」三个清单 */
export async function planChanges(sourceDir, { root, preserve = [], skip = [] }) {
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
    else if (!localBuffer.equals(sourceBuffer)) modified.push(rel)
    else same.push(rel)
  }

  return { added, modified, same, preserved, total: paths.length }
}
