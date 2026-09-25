// config-file.mjs — 博客站点配置（src/config.ts）的读取与写回
//
// 可视化编辑有两个矛盾点：既要能读到当前配置的值，又不能在保存时把文件里的
// 注释、排版和字段顺序全部冲掉（config.ts 是用户需要手工维护的文件）。
// 这里的做法：
//   1. 用一套极小的扫描器直接读源码里的对象字面量（不引入任何解析器依赖，
//      cms/server 由 Node 原生加载，保持零依赖）；
//   2. 保存时先与当前值做 diff，只替换「真正改动」的那几个值 / 键，
//      文件其余字节原样保留，注释自然跟着留在原地；
//   3. 写回后重新解析校验一遍，任何不一致都放弃写入并报错，不会写坏文件。
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// cms/server/ -> 仓库根 -> src/config.ts
export const CONFIG_PATH = fileURLToPath(new URL('../../src/config.ts', import.meta.url))
export const CONFIG_REL = 'src/config.ts'

// config.ts 里导出的全部配置对象（顺序即文件中的顺序）
export const CONFIG_EXPORTS = [
  'siteConfig',
  'profileConfig',
  'licenseConfig',
  'i18nConfig',
  'friendLinkConfig',
]

// ---------------- 词法：跳过字符串 / 注释 / 空白 ----------------

// 从 src[i]（引号）开始跳过一个字符串字面量，返回结束后的下标
function skipString(src, i) {
  const quote = src[i]
  i++
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    // 模板字符串里的 ${...} 允许嵌套大括号
    if (quote === '`' && ch === '$' && src[i + 1] === '{') {
      const end = matchDelim(src, i + 1)
      i = end < 0 ? src.length : end + 1
      continue
    }
    if (ch === quote) return i + 1
    i++
  }
  return i
}

// 跳过注释，返回结束后的下标；不在注释处则原样返回
function skipComment(src, i) {
  if (src[i] === '/' && src[i + 1] === '/') {
    const nl = src.indexOf('\n', i)
    return nl < 0 ? src.length : nl
  }
  if (src[i] === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2)
    return end < 0 ? src.length : end + 2
  }
  return i
}

// 跳过空白与注释
function skipTrivia(src, i) {
  for (;;) {
    const ch = src[i]
    if (ch === undefined) return i
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    const next = skipComment(src, i)
    if (next !== i) {
      i = next
      continue
    }
    return i
  }
}

// src[start] 为 { [ ( 之一，返回与之匹配的闭合字符下标（含），失败返回 -1
function matchDelim(src, start) {
  const open = src[start]
  const close = { '{': '}', '[': ']', '(': ')' }[open]
  if (!close) return -1
  let depth = 0
  let i = start
  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(src, i)
      continue
    }
    const next = skipComment(src, i)
    if (next !== i) {
      i = next
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

// ---------------- 定位：导出 / 成员 / 值区间 ----------------

// 找到 `export const <name>` 的初始化值起始下标
function findExportValue(src, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\b`)
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  i = skipTrivia(src, i)
  // 跳过类型注解（`: SiteConfig`、`: FriendLink[]` 等）
  if (src[i] === ':') {
    i++
    while (i < src.length && src[i] !== '=') {
      const ch = src[i]
      if (ch === '{' || ch === '[' || ch === '(') {
        const end = matchDelim(src, i)
        i = end < 0 ? i + 1 : end + 1
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        i = skipString(src, i)
        continue
      }
      i++
    }
  }
  i = skipTrivia(src, i)
  if (src[i] !== '=') return null
  return skipTrivia(src, i + 1)
}

// 值区间的结束下标：遇到同层的 , } ] 即结束。
// 注意：行尾注释不属于值的一部分，替换时必须留在原地，因此 end 只推进到值本身之后。
function findValueEnd(src, start) {
  let i = start
  let end = start
  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(src, i)
      end = i
      continue
    }
    const next = skipComment(src, i)
    if (next !== i) {
      i = next
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      const close = matchDelim(src, i)
      i = close < 0 ? src.length : close + 1
      end = i
      continue
    }
    if (ch === ',' || ch === '}' || ch === ']') return end
    if (!/\s/.test(ch)) end = i + 1
    i++
  }
  return end
}

// 读「键」（标识符或字符串），失败返回 null
function readKey(src, i, limit) {
  const ch = src[i]
  if (ch === '"' || ch === "'") {
    const end = skipString(src, i)
    return { key: unquote(src.slice(i, end)), after: end }
  }
  if (!/[A-Za-z_$]/.test(ch)) return null
  let j = i
  while (j < limit && /[A-Za-z0-9_$]/.test(src[j])) j++
  return { key: src.slice(i, j), after: j }
}

// 遍历对象 / 数组字面量的顶层成员，返回 [{ key, start, end }]
// 对象成员：key 为字段名；数组元素：key 为 null（展开元素也视为 null）
function iterateMembers(src, start) {
  const close = matchDelim(src, start)
  if (close < 0) return []
  const members = []
  let i = start + 1
  while (i < close) {
    i = skipTrivia(src, i)
    if (i >= close) break
    if (src[i] === ',') {
      i++
      continue
    }
    const info = readKey(src, i, close)
    if (info) {
      const colon = skipTrivia(src, info.after)
      if (src[colon] === ':') {
        const valueStart = skipTrivia(src, colon + 1)
        const valueEnd = findValueEnd(src, valueStart)
        members.push({ key: info.key, start: valueStart, end: valueEnd })
        i = valueEnd
        continue
      }
    }
    // 数组元素 / 简写属性
    const valueEnd = findValueEnd(src, i)
    members.push({ key: null, start: i, end: valueEnd })
    i = valueEnd > i ? valueEnd : i + 1
  }
  return members
}

// 按路径定位值区间：[siteConfig, toc, depth] / [friendLinkConfig, 0, name]
function locatePath(src, path) {
  if (!path || !path.length) return null
  const rootStart = findExportValue(src, String(path[0]))
  if (rootStart === null) return null
  if (path.length === 1) return { start: rootStart, end: findValueEnd(src, rootStart) }

  let current = rootStart
  for (let i = 1; i < path.length; i++) {
    const members = iterateMembers(src, current)
    const key = String(path[i])
    const member =
      src[current] === '[' && /^\d+$/.test(key)
        ? members[Number(key)]
        : members.find((m) => m.key !== null && m.key === key)
    if (!member) return null
    current = member.start
  }
  return { start: current, end: findValueEnd(src, current) }
}

// ---------------- 解析：把字面量读成 JS 值 ----------------

function unquote(lit) {
  const quote = lit[0]
  const inner = lit.slice(1, -1)
  return inner
    .replace(new RegExp(`\\\\${quote}`, 'g'), quote)
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

function parsePrimitive(raw) {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (raw === 'undefined') return undefined
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

// 从 src[i] 读取一个字面量，返回 [value, 结束下标]
function parseLiteral(src, i) {
  i = skipTrivia(src, i)
  const ch = src[i]
  if (ch === '{' || ch === '[') {
    const close = matchDelim(src, i)
    if (close < 0) return [null, src.length]
    const value = ch === '{' ? {} : []
    for (const m of iterateMembers(src, i)) {
      const [v] = parseLiteral(src, m.start)
      if (ch === '{') {
        if (m.key !== null) value[m.key] = v
      } else {
        value.push(v)
      }
    }
    return [value, close + 1]
  }
  if (ch === '"' || ch === "'" || ch === '`') {
    const end = skipString(src, i)
    return [unquote(src.slice(i, end)), end]
  }
  // 原始值：读到 , } ]、行尾或注释为止
  let j = i
  while (j < src.length) {
    const c = src[j]
    if (c === ',' || c === '}' || c === ']' || c === '\n') break
    if (c === '/' && (src[j + 1] === '/' || src[j + 1] === '*')) break
    j++
  }
  return [parsePrimitive(src.slice(i, j).trim()), j]
}

// 解析 config.ts，返回 { siteConfig, profileConfig, ... }
export function parseConfig(source) {
  const values = {}
  for (const name of CONFIG_EXPORTS) {
    const start = findExportValue(source, name)
    if (start === null) continue
    values[name] = parseLiteral(source, start)[0]
  }
  return values
}

// ---------------- 序列化 ----------------

function quoteString(value, prefer) {
  if (prefer === "'" && !value.includes("'") && !value.includes('\n')) {
    return `'${value.replace(/\\/g, '\\\\')}'`
  }
  return JSON.stringify(value)
}

// 键：能当标识符就直接写，否则用双引号（如 "zh-cn"）
function serializeKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

// 把 JS 值写成 config.ts 风格的字面量（缩进单位跟随原文件里的偏好）
export function serializeValue(value, indent = '', unit = '    ', prefer) {
  if (typeof value === 'string') return quoteString(value, prefer)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    // 短数组保持单行（与 config.ts 里 supportedLanguages 的写法一致）
    const inline = `[${value.map((v) => serializeValue(v, '', unit, prefer)).join(', ')}]`
    if (inline.length <= 72 && !inline.includes('\n')) return inline
    const inner = indent + unit
    const body = value
      .map((v) => inner + serializeValue(v, inner, unit, prefer))
      .join(',\n')
    return `[\n${body}\n${indent}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (!keys.length) return '{}'
    const inner = indent + unit
    const body = keys
      .map((k) => `${inner}${serializeKey(k)}: ${serializeValue(value[k], inner, unit, prefer)}`)
      .join(',\n')
    return `{\n${body}\n${indent}}`
  }
  return 'null'
}

// 取某一行开头的缩进
function lineIndent(src, index) {
  const lineStart = src.lastIndexOf('\n', index) + 1
  return /^[ \t]*/.exec(src.slice(lineStart, index))[0]
}

// 在对象字面量末尾插入一个新成员（用于「文件里还没有这个字段」的情况）
// 返回一组插入编辑（可能有两条：逗号 + 新成员，以便行尾注释留在原处）
function insertMember(src, objStart, key, value) {
  const close = matchDelim(src, objStart)
  if (close < 0) return null
  const members = iterateMembers(src, objStart)
  if (!members.length) {
    const base = lineIndent(src, objStart)
    const text = `\n${base}    ${serializeKey(key)}: ${serializeValue(value, base + '    ')}\n${base}`
    return [{ start: objStart + 1, end: objStart + 1, text }]
  }
  const last = members[members.length - 1]
  const nl = src.indexOf('\n', last.end)
  const lineEnd = nl < 0 ? src.length : nl
  const tail = src.slice(last.end, lineEnd)
  const hasComment = /^[ \t]*\/\//.test(tail)
  const hasComma = /^[ \t]*,/.test(tail)
  const at = hasComment ? lineEnd : last.end
  const indent = lineIndent(src, last.start) || lineIndent(src, objStart) + '    '
  const memberText = `\n${indent}${serializeKey(key)}: ${serializeValue(value, indent)}`

  if (at === last.end) {
    return [{ start: at, end: at, text: (hasComma ? '' : ',') + memberText }]
  }
  const edits = [{ start: at, end: at, text: memberText }]
  if (!hasComma) edits.push({ start: last.end, end: last.end, text: ',' })
  return edits
}

// 把嵌套的剩余路径展开成对象字面量值：[['Cover','title','home'], v] -> { Cover: { title: { home: v } } }
function nestValue(rest, value) {
  let out = value
  for (let i = rest.length - 1; i >= 0; i--) out = { [rest[i]]: out }
  return out
}

// ---------------- diff 与写回 ----------------

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // NaN 之类的极端情况直接判不等即可
    return false
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
}

// 只保留真正变化的叶子；未涉及的字节不会被改写。
// 数组：长度不变时逐项比较（保住元素里的注释）；仅在末尾追加 / 删除元素，
// 避免整段重写把数组内部的注释冲掉。
function diffValues(prev, next, path, ops) {
  if (Array.isArray(prev) && Array.isArray(next)) {
    const common = Math.min(prev.length, next.length)
    for (let i = 0; i < common; i++) diffValues(prev[i], next[i], [...path, i], ops)
    if (next.length > prev.length) {
      ops.push({ path, append: next.slice(prev.length) })
    } else if (next.length < prev.length) {
      if (!next.length) {
        // 清空数组：直接整体替换
        ops.push({ path, value: [] })
      } else {
        // 从后往前删，删除区间彼此相邻且互不重叠
        for (let i = prev.length - 1; i >= next.length; i--) {
          ops.push({ path: [...path, i], remove: true })
        }
      }
    }
    return
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    for (const key of Object.keys(next)) {
      diffValues(prev[key], next[key], [...path, key], ops)
    }
    return
  }
  if (!deepEqual(prev, next)) ops.push({ path, value: next })
}

export function getPath(obj, path) {
  let cur = obj
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined
    cur = cur[key]
  }
  return cur
}

// 在数组末尾追加若干元素（整批一次插入，顺序稳定）
function appendItems(src, arrStart, items) {
  const members = iterateMembers(src, arrStart)
  const base = lineIndent(src, arrStart)
  const primitives = items.every((v) => v === null || typeof v !== 'object')
  const inline = items.map((v) => serializeValue(v, '', '    ')).join(', ')
  const shortInline = primitives && inline.length <= 72 && !inline.includes('\n')

  if (!members.length) {
    if (shortInline) return [{ start: arrStart + 1, end: arrStart + 1, text: inline }]
    const indent = base + '    '
    const text = `\n${indent}${items.map((v) => serializeValue(v, indent)).join(`,\n${indent}`)}\n${base}`
    return [{ start: arrStart + 1, end: arrStart + 1, text }]
  }
  const last = members[members.length - 1]
  const nl = src.indexOf('\n', last.end)
  const lineEnd = nl < 0 ? src.length : nl
  const tail = src.slice(last.end, lineEnd)
  const hasComment = /^[ \t]*\/\//.test(tail)
  const hasComma = /^[ \t]*,/.test(tail)
  const indent = lineIndent(src, last.start) || base + '    '

  // 追加的都是原始值（如 supportedLanguages 的新语种）时保持单行
  if (shortInline) {
    return [{ start: last.end, end: last.end, text: (hasComma ? '' : ',') + ` ${inline}` }]
  }

  const memberText = items
    .map((v) => `\n${indent}${serializeValue(v, indent)}`)
    .join(',')

  if (hasComment) {
    const edits = [{ start: lineEnd, end: lineEnd, text: memberText }]
    if (!hasComma) edits.push({ start: last.end, end: last.end, text: ',' })
    return edits
  }
  return [{ start: last.end, end: last.end, text: (hasComma ? '' : ',') + memberText }]
}

// 删除数组元素：连同它前面的分隔符一起删掉，不会碰到相邻元素的注释
function removeItem(src, path) {
  const span = locatePath(src, path)
  const parent = locatePath(src, path.slice(0, -1))
  if (!span || !parent || src[parent.start] !== '[') return null
  const members = iterateMembers(src, parent.start)
  const index = Number(path[path.length - 1])
  const prev = members[index - 1]
  if (!prev) return null // 首元素整体清空由 diff 侧转换为整体替换
  let prevEnd = prev.end
  const nl = src.indexOf('\n', prevEnd)
  const lineEnd = nl < 0 ? src.length : nl
  if (/^[ \t]*\/\//.test(src.slice(prevEnd, lineEnd))) prevEnd = lineEnd
  return { start: prevEnd, end: span.end, text: '' }
}

// 生成写回后的源码（不落盘）；定位或校验失败时抛错
export function applyOps(source, ops) {
  const edits = []
  const changedPaths = []
  for (const op of ops) {
    if (op.remove) {
      const edit = removeItem(source, op.path)
      if (!edit) throw new Error(`无法定位数组元素: ${op.path.join('.')}`)
      edits.push(edit)
      changedPaths.push(op.path.slice(0, -1))
      continue
    }
    if (op.append) {
      const parent = locatePath(source, op.path)
      if (!parent || source[parent.start] !== '[') {
        throw new Error(`无法定位配置数组: ${op.path.join('.')}`)
      }
      edits.push(...appendItems(source, parent.start, op.append))
      changedPaths.push(op.path)
      continue
    }
    const span = locatePath(source, op.path)
    if (span) {
      const prefer = source[span.start] === "'" ? "'" : '"'
      const indent = lineIndent(source, span.start)
      edits.push({
        start: span.start,
        end: span.end,
        text: serializeValue(op.value, indent, '    ', prefer),
      })
      changedPaths.push(op.path)
      continue
    }
    // 值不存在 -> 逐级回退，找到最深的已存在对象后插入
    let placed = null
    for (let i = op.path.length - 1; i >= 1 && !placed; i--) {
      const parent = locatePath(source, op.path.slice(0, i))
      if (!parent || source[parent.start] !== '{') continue
      placed = insertMember(source, parent.start, op.path[i], nestValue(op.path.slice(i + 1), op.value))
    }
    if (!placed) throw new Error(`无法定位配置字段: ${op.path.join('.')}`)
    edits.push(...placed)
    changedPaths.push(op.path)
  }

  // 从后往前替换，避免前面的改动导致后面的下标位移；
  // 正常情况下 diff 产生的区间互不重叠，出现重叠说明定位异常，直接放弃写入
  edits.sort((a, b) => a.start - b.start || a.end - b.end)
  for (let i = 1; i < edits.length; i++) {
    if (edits[i].start < edits[i - 1].end) throw new Error('配置改动区间重叠，已放弃写入')
  }
  edits.sort((a, b) => b.start - a.start)
  let out = source
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  return { source: out, changedPaths }
}

// 读取 config.ts 原文与解析结果
export async function readConfig() {
  const source = await readFile(CONFIG_PATH, 'utf-8')
  return { path: CONFIG_REL, source, values: parseConfig(source) }
}

// 用客户端提交的完整配置值写回 config.ts
// 返回 { path, source, values, changed }；任何异常都不会留下半成品文件
export async function writeConfig(nextValues) {
  const before = await readConfig()
  const ops = []
  diffValues(before.values, nextValues, [], ops)
  if (!ops.length) return { ...before, changed: false }

  const { source, changedPaths } = applyOps(before.source, ops)
  const values = parseConfig(source)
  // 写回前校验：改动过的路径必须与期望值一致，否则整体放弃
  for (const path of changedPaths) {
    if (!deepEqual(getPath(values, path), getPath(nextValues, path))) {
      throw new Error(`配置写回校验失败: ${path.join('.')}（为安全起见未写入文件）`)
    }
  }
  await writeFile(CONFIG_PATH, source, 'utf-8')
  return { path: CONFIG_REL, source, values, changed: true }
}
