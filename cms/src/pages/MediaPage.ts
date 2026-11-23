// MediaPage.ts — 媒体库：浏览 / 上传 / 复制引用 / 重命名 / 删除
import { api } from '../api'
import type { MediaItem, MediaList, MediaScope } from '../types'
import { el } from '../dom'
import { createSelect, type SelectControl } from '../select'
import { toast } from '../ui'
import { pageHeader } from './header'

interface MediaState {
  scope: MediaScope
  q: string
  /** 上传目录（相对 scope 根目录，'' 表示根目录） */
  dir: string
  dirs: string[]
  list: MediaList | null
}

interface AppRoot extends HTMLElement {
  __cleanup?: () => void
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

// 引用写法：blog 图片相对文章目录（./xxx），public 图片相对站点根（/xxx）
function markdownFor(item: MediaItem, scope: MediaScope) {
  const alt = item.altName || stripExt(item.name)
  let rel = item.path
  if (scope === 'blog' && item.articleDir !== null) {
    const prefix = item.articleDir ? item.articleDir + '/' : ''
    if (item.path.startsWith(prefix)) rel = item.path.slice(prefix.length)
  }
  const ref = scope === 'public' ? `/${item.path}` : `./${rel}`
  return `![${alt}](${ref})`
}

// alt 建议文案：文件名（去扩展名 / 连字符）+ 宽高
function altFor(item: MediaItem) {
  const base = item.altName || stripExt(item.name)
  return item.width && item.height ? `${base} ${item.width}×${item.height}` : base
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function copyText(text: string, label = '已复制') {
  try {
    await navigator.clipboard.writeText(text)
    toast(label)
    return
  } catch {
    /* 非安全上下文时回退到 execCommand */
  }
  const ta = el('textarea', { class: 'media-copy-fallback' })
  ta.value = text
  document.body.append(ta)
  ta.select()
  try {
    document.execCommand('copy')
    toast(label)
  } catch {
    toast('复制失败，请手动复制', 'error')
  }
  ta.remove()
}

export async function renderMedia(root: HTMLElement) {
  const state: MediaState = {
    scope: 'blog',
    q: '',
    dir: '',
    dirs: [],
    list: null,
  }

  const uploadBtn = el('button', {
    class: 'btn btn-primary',
    id: 'media-upload',
    onclick: () => pickFiles(),
  }, ['＋ 上传图片'])

  const tabBlog = el('button', { class: 'media-tab active', type: 'button', 'aria-selected': 'true' }, ['博客图片'])
  const tabPublic = el('button', { class: 'media-tab', type: 'button', 'aria-selected': 'false' }, ['public 图片'])
  tabBlog.addEventListener('click', () => setScope('blog'))
  tabPublic.addEventListener('click', () => setScope('public'))

  const dirSelect: SelectControl = createSelect({
    id: 'media-dir',
    title: '上传到哪个目录',
    options: [{ value: '', label: '根目录' }],
    onChange: (value: string) => {
      state.dir = value
    },
  })

  const searchInput = el('input', {
    class: 'input input-search',
    type: 'search',
    placeholder: '搜索文件名 / 路径…',
    oninput: (e: Event) => {
      state.q = (e.target as HTMLInputElement).value
      debouncedLoad()
    },
  })

  const countEl = el('span', { class: 'cms-count', id: 'media-count' })
  const notice = el('div', { class: 'media-notice', id: 'media-notice', hidden: true })
  const truncatedEl = el('div', { class: 'media-truncated', hidden: true }, [
    '图片数量超过 2000 张，列表只显示前 2000 张。',
  ])
  const grid = el('div', { class: 'media-groups', id: 'media-groups' })
  const emptyEl = el('div', { class: 'cms-empty', id: 'media-empty', hidden: true }, [
    '这个范围内还没有图片，点右上角「上传图片」或把图片拖进来。',
  ])
  const dropHint = el('div', { class: 'media-drop-hint', hidden: true }, ['松开鼠标上传到当前目录'])
  const dropZone = el('div', { class: 'media-drop' }, [grid, truncatedEl, emptyEl, dropHint])

  const main = el('main', { class: 'cms-main media-main' }, [
    el('div', { class: 'cms-toolbar' }, [
      el('div', { class: 'media-tabs', role: 'tablist' }, [tabBlog, tabPublic]),
      searchInput,
      el('span', { class: 'media-dir-label' }, ['上传到']),
      dirSelect,
      countEl,
    ]),
    el('p', { class: 'media-hint' }, [
      'blog 下的图片用相对文章目录的 ',
      el('code', {}, ['./xxx']),
      ' 引用，public 下的用 ',
      el('code', {}, ['/xxx']),
      ' 引用；上传时会自动压缩长边超过 2400px 的图片，并按内容去重。',
    ]),
    notice,
    dropZone,
  ])

  root.append(pageHeader('media', uploadBtn), main)

  let timer = 0
  let loadSeq = 0
  let dragging = 0

  function debouncedLoad() {
    clearTimeout(timer)
    timer = window.setTimeout(() => void load(), 250)
  }

  function setScope(scope: MediaScope) {
    if (state.scope === scope) return
    state.scope = scope
    state.dir = ''
    state.list = null
    notice.hidden = true
    grid.textContent = '加载中…'
    countEl.textContent = ''
    // 目录候选属于上一个 scope，先退回根目录，避免上传到另一个 scope 的旧目录
    dirSelect.setOptions(
      [{ value: '', label: scope === 'blog' ? '博客根目录' : 'public 根目录' }],
      '',
    )
    tabBlog.classList.toggle('active', scope === 'blog')
    tabPublic.classList.toggle('active', scope === 'public')
    tabBlog.setAttribute('aria-selected', String(scope === 'blog'))
    tabPublic.setAttribute('aria-selected', String(scope === 'public'))
    void load()
  }

  // 上传目录候选：blog 用文章目录（即使还没图片），public 用实际存在的目录；根目录始终可选项
  function syncDirOptions(list: MediaList) {
    const dirs = [...new Set([...(list.dirs || []), ...list.groups.map((g) => g.dir)])].filter(
      (d) => d !== '.',
    )
    state.dirs = dirs
    const options = [
      { value: '', label: state.scope === 'blog' ? '博客根目录' : 'public 根目录' },
      ...dirs.map((d) => ({ value: d, label: d })),
    ]
    if (state.dir && !dirs.includes(state.dir)) state.dir = ''
    dirSelect.setOptions(options, state.dir)
  }

  function showDuplicate(item: MediaItem) {
    notice.textContent = ''
    notice.hidden = false
    notice.append(
      el('span', { class: 'media-notice-text' }, [
        `已存在同一张图：${item.path}，可直接复用。`,
      ]),
      el('button', {
        class: 'btn btn-sm',
        type: 'button',
        onclick: () => copyText(markdownFor(item, state.scope), '已复制 Markdown 片段'),
      }, ['复制 Markdown']),
      el('button', {
        class: 'btn btn-sm',
        type: 'button',
        onclick: () => copyText(item.path, '已复制路径'),
      }, ['复制路径']),
      el('button', {
        class: 'btn btn-sm',
        type: 'button',
        onclick: () => { notice.hidden = true },
      }, ['关闭']),
    )
  }

  function mediaCard(item: MediaItem) {
    const subParts = [
      item.width && item.height ? `${item.width}×${item.height}` : '尺寸未知',
      formatSize(item.size),
      formatDate(item.mtime),
    ]
    const img = el('img', {
      src: item.url,
      alt: altFor(item),
      loading: 'lazy',
      decoding: 'async',
    })
    img.addEventListener('error', () => img.classList.add('is-broken'))

    return el('figure', { class: 'media-card' }, [
      el('a', {
        class: 'media-thumb',
        href: item.url,
        target: '_blank',
        rel: 'noopener',
        title: '在新标签页查看原图',
      }, [img]),
      el('figcaption', { class: 'media-meta' }, [
        el('div', { class: 'media-name', title: item.path }, [item.name]),
        el('div', { class: 'media-sub' }, [subParts.join(' · ')]),
        el('div', { class: 'media-actions' }, [
          el('button', {
            class: 'media-act',
            type: 'button',
            title: markdownFor(item, state.scope),
            onclick: () => copyText(markdownFor(item, state.scope), '已复制 Markdown 片段'),
          }, ['复制 MD']),
          el('button', {
            class: 'media-act',
            type: 'button',
            title: altFor(item),
            onclick: () => copyText(altFor(item), '已复制 alt 建议'),
          }, ['复制 alt']),
          el('button', {
            class: 'media-act',
            type: 'button',
            onclick: () => renameItem(item),
          }, ['重命名']),
          el('button', {
            class: 'media-act media-act-danger',
            type: 'button',
            onclick: () => removeItem(item),
          }, ['删除']),
        ]),
      ]),
    ])
  }

  function render() {
    const list = state.list
    grid.textContent = ''
    if (!list) return
    countEl.textContent = `共 ${list.total} 张`
    truncatedEl.hidden = !list.truncated
    emptyEl.hidden = list.total > 0

    for (const group of list.groups) {
      const label = group.dir === '.'
        ? (state.scope === 'blog' ? '未归属文章' : '根目录')
        : group.dir
      const cards = el('div', { class: 'media-grid' }, group.items.map(mediaCard))
      grid.append(
        el('section', { class: 'media-group', 'data-dir': group.dir }, [
          el('div', { class: 'media-group-head' }, [
            el('span', { class: 'media-group-dir' }, [label]),
            el('span', { class: 'media-group-count' }, [`${group.items.length} 张`]),
          ]),
          cards,
        ]),
      )
    }
    if (list.total === 0) {
      grid.textContent = ''
    }
    if (!list.sharp) {
      notice.hidden = false
      notice.textContent = ''
      notice.append(el('span', { class: 'media-notice-text' }, [
        '当前环境未能加载 sharp，上传的图片不会压缩，宽高改用文件头解析（响应里 compressed 为 false）。',
      ]))
    }
  }

  async function load() {
    const seq = ++loadSeq
    // 首次进入时占位
    if (!state.list) grid.textContent = '加载中…'
    try {
      const list = await api.mediaList({ scope: state.scope, q: state.q })
      if (seq !== loadSeq) return
      state.list = list
      syncDirOptions(list)
      render()
    } catch (e) {
      if (seq !== loadSeq) return
      toast((e as Error).message, 'error')
      grid.textContent = ''
    }
  }

  async function removeItem(item: MediaItem) {
    if (!window.confirm(`确定删除图片「${item.path}」？\n此操作不可恢复。`)) return
    try {
      await api.mediaRemove(state.scope, item.path)
      toast('已删除')
      await load()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function renameItem(item: MediaItem) {
    const next = window.prompt('重命名图片（不会自动更新文章里的引用）', item.name)
    if (next === null) return
    const name = next.trim()
    if (!name || name === item.name) return
    try {
      const res = await api.mediaRename(state.scope, item.path, name)
      toast(`已重命名为 ${res.name}`)
      await load()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  function pickFiles() {
    const input = el('input', { type: 'file', accept: 'image/*', multiple: true })
    input.addEventListener('change', () => {
      const files = [...(input.files || [])]
      if (files.length) void uploadFiles(files)
    })
    input.click()
  }

  async function uploadFiles(files: File[]) {
    const scope = state.scope
    const dir = state.dir
    let uploaded = 0
    let duplicated = 0
    for (const file of files) {
      try {
        const res = await api.mediaUpload(file, scope, dir)
        if (res.duplicate) {
          duplicated++
          showDuplicate(res.duplicate)
          toast(`「${file.name}」已存在同一张图，可直接复用`)
        } else {
          uploaded++
          toast(`已上传 ${res.name}${res.compressed ? '（已压缩）' : '（原样保存）'}`)
        }
      } catch (e) {
        toast(`${file.name}: ${(e as Error).message}`, 'error')
      }
    }
    if (uploaded || duplicated) await load()
  }

  // 拖拽上传只认文件，不拦截文本 / 链接的默认行为
  const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types || [])].includes('Files')
  main.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragging++
    dropHint.hidden = false
  })
  main.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    dropHint.hidden = false
  })
  main.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return
    dragging = Math.max(0, dragging - 1)
    if (!dragging) dropHint.hidden = true
  })
  main.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragging = 0
    dropHint.hidden = true
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'))
    if (files.length) void uploadFiles(files)
    else toast('只能上传图片文件', 'error')
  })

  await load()

  ;(root as AppRoot).__cleanup = () => {
    clearTimeout(timer)
    loadSeq++
  }
}
