// MediaPage.ts — 媒体库：浏览 / 图床弹窗上传 / 复制引用 / 重命名 / 替换 / 移动 / 删除 / 未引用清理
import { api } from '../api'
import type { MediaArticleTarget, MediaEstimate, MediaItem, MediaList, MediaScope } from '../types'
import { el } from '../dom'
import { createSelect, type SelectControl } from '../select'
import { toast } from '../ui'
import {
  altFor,
  closeActiveOverlays,
  copyText,
  createOverlay,
  formatDate,
  formatSize,
  imageThumb,
  isImageFile,
  markdownFor,
  stripExt,
} from '../media-shared'
import { pageHeader } from './header'

interface MediaState {
  scope: MediaScope
  q: string
  list: MediaList | null
  /** 批量选择：默认关闭，关闭时卡片上没有多选框 */
  batchMode: boolean
  selected: Set<string>
}

interface AppRoot extends HTMLElement {
  __cleanup?: () => void
}

type QueueStatus = 'pending' | 'uploading' | 'done' | 'duplicate' | 'error'

interface QueueItem {
  id: number
  file: File
  url: string
  name: string
  size: number
  status: QueueStatus
  error?: string
  result?: MediaItem
}

interface UploadResult {
  key: string
  name: string
  /** 预览地址（本地图片走 /api/media/file，外链直接用原地址） */
  url: string
  markdown: string
  /** 本地图片的路径；外链为空 */
  path: string
  note: string
}

const STATUS_TEXT: Record<QueueStatus, string> = {
  pending: '等待上传',
  uploading: '上传中…',
  done: '已完成',
  duplicate: '已存在同一张图',
  error: '上传失败',
}

export async function renderMedia(root: HTMLElement) {
  const state: MediaState = {
    scope: 'blog',
    q: '',
    list: null,
    batchMode: false,
    selected: new Set(),
  }

  // ---------------- 顶部 / 工具栏 ----------------

  const uploadBtn = el('button', {
    class: 'btn btn-primary',
    id: 'media-upload',
    onclick: () => openUploadModal({ scope: state.scope }),
  }, ['＋ 上传图片'])

  const batchToggle = el('button', {
    class: 'btn btn-sm',
    id: 'media-batch-toggle',
    type: 'button',
    'aria-pressed': 'false',
    title: '开启批量选择',
    onclick: () => setBatchMode(!state.batchMode),
  }, ['批量选择'])

  const unusedBtn = el('button', {
    class: 'btn btn-sm',
    id: 'media-unused',
    type: 'button',
    title: '扫描没有被任何文章 / 页面引用的图片',
    onclick: () => openUnusedModal(),
  }, ['清理未引用'])

  const tabBlog = el('button', { class: 'media-tab active', type: 'button', 'aria-selected': 'true' }, ['博客图片'])
  const tabPublic = el('button', { class: 'media-tab', type: 'button', 'aria-selected': 'false' }, ['public 图片'])
  tabBlog.addEventListener('click', () => setScope('blog'))
  tabPublic.addEventListener('click', () => setScope('public'))

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

  const selectAllBox = el('input', {
    type: 'checkbox',
    id: 'media-select-all',
    'aria-label': '全选当前范围的全部图片',
  })
  const batchCount = el('span', { class: 'batch-count' })
  const batchDeleteBtn = el('button', {
    class: 'btn btn-sm btn-danger',
    type: 'button',
    disabled: true,
    onclick: () => void removeSelected(),
  }, ['删除所选'])
  const batchBar = el('div', { class: 'batch-bar', id: 'media-batch-bar', hidden: true }, [
    el('span', { class: 'batch-title' }, ['批量选择']),
    batchCount,
    el('label', { class: 'select-all', title: '全选当前范围的全部图片' }, [
      selectAllBox,
      el('span', {}, ['全选']),
    ]),
    el('button', {
      class: 'btn btn-sm',
      type: 'button',
      onclick: () => clearSelection(),
    }, ['清空']),
    el('span', { class: 'batch-sep' }),
    batchDeleteBtn,
  ])

  const grid = el('div', { class: 'media-groups', id: 'media-groups' })
  const emptyEl = el('div', { class: 'cms-empty', id: 'media-empty', hidden: true }, [
    '这个范围内还没有图片，点右上角「上传图片」或把图片拖进来。',
  ])
  const dropHint = el('div', { class: 'media-drop-hint', hidden: true }, ['松开鼠标，选择要上传到的博客'])
  const dropZone = el('div', { class: 'media-drop' }, [grid, truncatedEl, emptyEl, dropHint])

  const main = el('main', { class: 'cms-main media-main' }, [
    el('div', { class: 'cms-toolbar' }, [
      el('div', { class: 'media-tabs', role: 'tablist' }, [tabBlog, tabPublic]),
      searchInput,
      batchToggle,
      unusedBtn,
      countEl,
    ]),
    el('p', { class: 'media-hint' }, [
      '博客图片统一放在文章目录下的 ',
      el('code', {}, ['images/']),
      '，引用写 ',
      el('code', {}, ['./images/xxx.png']),
      '；public 图片引用写 ',
      el('code', {}, ['/xxx.png']),
      '。上传时自动压缩长边超过 2400px 的图片，并按内容去重。',
    ]),
    notice,
    batchBar,
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
    state.selected.clear()
    state.list = null
    notice.hidden = true
    grid.textContent = '加载中…'
    countEl.textContent = ''
    tabBlog.classList.toggle('active', scope === 'blog')
    tabPublic.classList.toggle('active', scope === 'public')
    tabBlog.setAttribute('aria-selected', String(scope === 'blog'))
    tabPublic.setAttribute('aria-selected', String(scope === 'public'))
    updateBatchUi()
    void load()
  }

  // ---------------- 批量选择 ----------------

  function setBatchMode(on: boolean) {
    if (state.batchMode === on) return
    state.batchMode = on
    if (!on) state.selected.clear()
    batchToggle.textContent = on ? '退出选择' : '批量选择'
    batchToggle.classList.toggle('is-active', on)
    batchToggle.setAttribute('aria-pressed', String(on))
    batchToggle.title = on ? '退出批量选择' : '开启批量选择'
    render()
  }

  function toggleItem(path: string, checked: boolean) {
    if (checked) state.selected.add(path)
    else state.selected.delete(path)
    const cards = root.querySelectorAll<HTMLElement>('[data-path]')
    cards.forEach((card) => {
      if (card.dataset.path !== path) return
      card.classList.toggle('is-selected', checked)
      const box = card.querySelector<HTMLInputElement>('input.media-check')
      if (box) box.checked = checked
    })
    updateBatchUi()
  }

  function toggleAll(checked: boolean) {
    const paths = visiblePaths()
    if (checked) for (const path of paths) state.selected.add(path)
    else state.selected.clear()
    for (const card of root.querySelectorAll<HTMLElement>('[data-path]')) {
      const on = state.selected.has(card.dataset.path || '')
      card.classList.toggle('is-selected', on)
      const box = card.querySelector<HTMLInputElement>('input.media-check')
      if (box) box.checked = on
    }
    updateBatchUi()
  }

  function clearSelection() {
    state.selected.clear()
    for (const card of root.querySelectorAll<HTMLElement>('[data-path]')) {
      card.classList.remove('is-selected')
      const box = card.querySelector<HTMLInputElement>('input.media-check')
      if (box) box.checked = false
    }
    updateBatchUi()
  }

  function updateBatchUi() {
    const count = state.selected.size
    batchCount.textContent = `已选 ${count} 张`
    batchBar.hidden = !state.batchMode
    batchDeleteBtn.disabled = count === 0
    const paths = visiblePaths()
    const selectedVisible = paths.filter((p) => state.selected.has(p)).length
    selectAllBox.checked = paths.length > 0 && selectedVisible === paths.length
    selectAllBox.indeterminate = selectedVisible > 0 && selectedVisible < paths.length
  }

  function visiblePaths() {
    const list = state.list
    if (!list) return []
    return list.groups.flatMap((g) => g.items.map((i) => i.path))
  }

  // 切换筛选 / 刷新后只保留仍然可见的选中项
  function pruneSelection() {
    const visible = new Set(visiblePaths())
    for (const path of [...state.selected]) if (!visible.has(path)) state.selected.delete(path)
  }

  async function removeSelected() {
    const paths = [...state.selected]
    if (!paths.length) return
    if (!window.confirm(`确定删除选中的 ${paths.length} 张图片？\n此操作不可恢复，文章里的引用会变成裂图。`)) return
    const failed: string[] = []
    const failedPaths = new Set<string>()
    let ok = 0
    for (const path of paths) {
      try {
        await api.mediaRemove(state.scope, path)
        ok++
      } catch (e) {
        failed.push(`${path}：${(e as Error).message}`)
        failedPaths.add(path)
      }
    }
    if (failed.length) toast(`成功 ${ok} 张，失败 ${failed.length} 张`, 'error')
    else toast(`已删除 ${ok} 张图片`)
    // 失败项保持选中，方便重试
    state.selected = failedPaths
    await load()
  }

  // ---------------- 列表渲染 ----------------

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
    const selected = state.selected.has(item.path)
    const subParts = [
      item.width && item.height ? `${item.width}×${item.height}` : '尺寸未知',
      formatSize(item.size),
    ]

    const check = state.batchMode
      ? el('input', {
          type: 'checkbox',
          class: 'media-check',
          checked: selected,
          'aria-label': `选择 ${item.name}`,
          onclick: (e: Event) => e.stopPropagation(),
          onchange: (e: Event) => toggleItem(item.path, (e.target as HTMLInputElement).checked),
        })
      : null

    const thumb = el('button', {
      class: 'media-thumb',
      type: 'button',
      title: '查看大图与操作',
      onclick: (e: Event) => {
        e.stopPropagation()
        if (state.batchMode) toggleItem(item.path, !state.selected.has(item.path))
        else openLightbox(item)
      },
    }, [imageThumb(item, 'media-thumb-inner')])

    return el('figure', {
      class: 'media-card' + (selected ? ' is-selected' : ''),
      'data-path': item.path,
      onclick: () => {
        if (state.batchMode) toggleItem(item.path, !state.selected.has(item.path))
        else openLightbox(item)
      },
    }, [
      check,
      thumb,
      el('figcaption', { class: 'media-meta' }, [
        el('div', { class: 'media-name', title: item.path }, [item.name]),
        el('div', { class: 'media-sub' }, [subParts.join(' · ')]),
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
      const head = el('div', { class: 'media-group-head' }, [
        el('span', { class: 'media-group-dir' }, [label]),
        el('span', { class: 'media-group-count' }, [`${group.items.length} 张`]),
        group.dir === '.' && state.scope === 'blog'
          ? null
          : el('button', {
              class: 'media-group-upload',
              type: 'button',
              title: '上传图片到这个目录',
              onclick: () => openUploadModal({ scope: state.scope, dir: group.dir === '.' ? '' : group.dir }),
            }, ['＋ 上传到这里']),
      ])
      grid.append(el('section', { class: 'media-group', 'data-dir': group.dir }, [head, cards]))
    }

    if (!list.sharp) {
      notice.hidden = false
      notice.textContent = ''
      notice.append(el('span', { class: 'media-notice-text' }, [
        '当前环境未能加载 sharp，上传的图片不会压缩，宽高改用文件头解析（响应里 compressed 为 false）。',
      ]))
    }
    pruneSelection()
    updateBatchUi()
  }

  async function load() {
    const seq = ++loadSeq
    if (!state.list) grid.textContent = '加载中…'
    try {
      const list = await api.mediaList({ scope: state.scope, q: state.q })
      if (seq !== loadSeq) return
      state.list = list
      render()
    } catch (e) {
      if (seq !== loadSeq) return
      toast((e as Error).message, 'error')
      grid.textContent = ''
    }
  }

  // ---------------- 单张操作 ----------------

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

  function replaceItem(item: MediaItem) {
    const input = el('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      void (async () => {
        try {
          const res = await api.mediaReplace(state.scope, item.path, file)
          toast(`已替换 ${res.name}${res.compressed ? '（已压缩）' : ''}`)
          await load()
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      })()
    })
    input.click()
  }

  // ---------------- 大图 / 详情 ----------------

  function openLightbox(item: MediaItem) {
    const refsEl = el('div', { class: 'media-detail-refs' }, ['正在查找引用…'])
    const info = el('div', { class: 'media-detail-info' }, [
      el('div', { class: 'media-detail-title' }, [item.name]),
      el('div', { class: 'media-detail-sub' }, [
        item.width && item.height ? `${item.width}×${item.height}` : '尺寸未知',
        ' · ',
        formatSize(item.size),
        ' · ',
        formatDate(item.mtime),
      ]),
      el('div', { class: 'media-detail-path' }, [item.path]),
      refsEl,
      el('div', { class: 'media-detail-actions' }, [
        el('button', {
          class: 'btn btn-sm',
          type: 'button',
          onclick: () => copyText(markdownFor(item, state.scope), '已复制 Markdown 片段'),
        }, ['复制 Markdown']),
        el('button', {
          class: 'btn btn-sm',
          type: 'button',
          onclick: () => copyText(altFor(item), '已复制 alt 建议'),
        }, ['复制 alt']),
        el('button', {
          class: 'btn btn-sm',
          type: 'button',
          onclick: () => copyText(item.path, '已复制路径'),
        }, ['复制路径']),
        el('span', { class: 'batch-sep' }),
        el('button', {
          class: 'btn btn-sm',
          type: 'button',
          onclick: () => {
            close()
            replaceItem(item)
          },
        }, ['替换图片']),
        el('button', {
          class: 'btn btn-sm',
          type: 'button',
          onclick: () => {
            close()
            openMoveModal(item)
          },
        }, ['移动到…']),
        el('button', {
          class: 'btn btn-sm',
          type: 'button',
          onclick: () => {
            close()
            void renameItem(item)
          },
        }, ['重命名']),
        el('button', {
          class: 'btn btn-sm btn-danger',
          type: 'button',
          onclick: () => {
            close()
            void removeItem(item)
          },
        }, ['删除']),
      ]),
    ])

    const { overlay, close } = createOverlay('media-lightbox', () => {})
    overlay.append(
      el('div', { class: 'media-lightbox-body' }, [
        el('button', {
          class: 'media-lightbox-close',
          type: 'button',
          'aria-label': '关闭',
          onclick: () => close(),
        }, ['×']),
        el('img', { class: 'media-lightbox-img', src: item.url, alt: altFor(item) }),
        info,
      ]),
    )
    root.append(overlay)

    api.mediaRefs(state.scope, item.path)
      .then((res) => {
        refsEl.textContent = ''
        if (!res.refs.length) {
          refsEl.append(el('span', { class: 'media-detail-muted' }, ['没有被任何 Markdown 引用']))
          return
        }
        refsEl.append(el('div', {}, [`被 ${res.refs.length} 个文件引用：`]))
        const list = el('ul', { class: 'media-detail-list' })
        for (const file of res.refs) list.append(el('li', {}, [file]))
        refsEl.append(list)
      })
      .catch(() => {
        refsEl.textContent = '引用信息读取失败'
      })
  }

  // ---------------- 移动到其他目录 ----------------

  function openMoveModal(item: MediaItem) {
    let targetScope: MediaScope = state.scope
    let targetDirValue = ''

    const targetSelect: SelectControl = createSelect({
      id: 'move-target',
      title: '移动到的目录',
      options: [{ value: '', label: '加载中…' }],
      onChange: (value: string) => {
        targetDirValue = value
      },
    })

    const blogTab = el('button', { class: 'media-tab' + (targetScope === 'blog' ? ' active' : ''), type: 'button' }, ['博客目录'])
    const publicTab = el('button', { class: 'media-tab' + (targetScope === 'public' ? ' active' : ''), type: 'button' }, ['public 目录'])

    const refsHint = el('div', { class: 'media-move-refs' }, ['正在检查引用…'])
    const targetHint = el('small', { class: 'modal-hint' })

    function syncTargets(preselect?: string) {
      const list = state.list
      if (targetScope === 'blog') {
        const articles: MediaArticleTarget[] = list?.articles ?? []
        targetSelect.setOptions(
          articles.length
            ? articles.map((a) => ({ value: a.dir, label: a.title ? `${a.title}（${a.dir}）` : a.dir }))
            : [{ value: '', label: '还没有文章' }],
          preselect ?? articles[0]?.dir ?? '',
        )
        targetHint.textContent = '博客图片会放进所选文章的 images 子目录。'
      } else {
        const dirs = list?.dirs ?? []
        targetSelect.setOptions(
          [{ value: '', label: 'public 根目录' }, ...dirs.map((d) => ({ value: d, label: d }))],
          preselect ?? '',
        )
        targetHint.textContent = 'public 图片会放进所选目录。'
      }
      targetDirValue = targetSelect.value
      blogTab.classList.toggle('active', targetScope === 'blog')
      publicTab.classList.toggle('active', targetScope === 'public')
    }

    blogTab.addEventListener('click', () => {
      targetScope = 'blog'
      syncTargets()
    })
    publicTab.addEventListener('click', () => {
      targetScope = 'public'
      syncTargets()
    })
    syncTargets(targetScope === 'blog' ? item.articleDir ?? undefined : undefined)

    const { overlay, close } = createOverlay('media-move', () => {})
    const moveBtn = el('button', {
      class: 'btn btn-primary',
      type: 'button',
      onclick: () => void doMove(),
    }, ['移动'])

    overlay.append(
      el('div', { class: 'media-dialog media-dialog-sm' }, [
        el('h2', { class: 'modal-title' }, ['移动图片']),
        el('div', { class: 'media-dialog-path' }, [item.path]),
        el('label', { class: 'modal-field' }, [
          '目标范围',
          el('div', { class: 'media-tabs' }, [blogTab, publicTab]),
        ]),
        el('label', { class: 'modal-field' }, [
          '目标目录',
          targetSelect,
          targetHint,
        ]),
        el('div', { class: 'media-move-warning' }, [
          '⚠️ 移动后文章里的旧引用不会自动更新，需要手动改成本地路径或相对路径。',
        ]),
        refsHint,
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn', type: 'button', onclick: () => close() }, ['取消']),
          moveBtn,
        ]),
      ]),
    )
    root.append(overlay)

    api.mediaRefs(state.scope, item.path)
      .then((res) => {
        refsHint.textContent = res.refs.length
          ? `该图片当前被 ${res.refs.length} 个文件引用：${res.refs.join('、')}`
          : '该图片当前没有被任何 Markdown 引用，移动不会影响文章。'
      })
      .catch(() => {
        refsHint.textContent = ''
      })

    async function doMove() {
      const dir = targetScope === 'blog'
        ? (targetDirValue ? `${targetDirValue}/images` : '')
        : targetDirValue
      if (targetScope === 'blog' && !dir) {
        toast('请选择目标文章', 'error')
        return
      }
      moveBtn.disabled = true
      try {
        const res = await api.mediaMove({
          scope: state.scope,
          path: item.path,
          targetScope,
          targetDir: dir,
        })
        toast(`已移动到 ${targetScope === 'public' ? 'public/' : ''}${res.path}`)
        close()
        await load()
      } catch (e) {
        toast((e as Error).message, 'error')
        moveBtn.disabled = false
      }
    }
  }

  // ---------------- 未引用图片清理 ----------------

  async function openUnusedModal() {
    const scope = state.scope
    const listEl = el('div', { class: 'media-unused-list' }, [
      el('div', { class: 'media-detail-muted' }, ['正在扫描引用…']),
    ])
    const summary = el('div', { class: 'media-unused-summary' })
    const deleteBtn = el('button', {
      class: 'btn btn-danger',
      type: 'button',
      disabled: true,
      onclick: () => void doDelete(),
    }, ['删除选中'])

    const { overlay, close } = createOverlay('media-unused', () => {})
    overlay.append(
      el('div', { class: 'media-dialog' }, [
        el('h2', { class: 'modal-title' }, ['未引用的图片']),
        el('p', { class: 'modal-hint' }, [
          '扫描 src / 根目录配置里所有文本引用。只删除这里勾选的图片，删除前请确认缩略图。',
        ]),
        summary,
        listEl,
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn', type: 'button', onclick: () => close() }, ['取消']),
          deleteBtn,
        ]),
      ]),
    )
    root.append(overlay)

    let checked = new Set<string>()
    let items: MediaItem[] = []

    function syncSummary() {
      const selected = items.filter((i) => checked.has(i.path))
      const bytes = selected.reduce((sum, i) => sum + i.size, 0)
      summary.textContent = items.length
        ? `共 ${items.length} 张未引用，已选 ${selected.length} 张（${formatSize(bytes)}）`
        : '没有发现未被引用的图片。'
      deleteBtn.disabled = selected.length === 0
    }

    function row(item: MediaItem) {
      const box = el('input', {
        type: 'checkbox',
        class: 'media-check',
        checked: true,
        'aria-label': `选择 ${item.name}`,
        onchange: (e: Event) => {
          if ((e.target as HTMLInputElement).checked) checked.add(item.path)
          else checked.delete(item.path)
          syncSummary()
        },
      })
      return el('div', { class: 'media-unused-row' }, [
        box,
        imageThumb(item, 'media-unused-thumb'),
        el('div', { class: 'media-unused-meta' }, [
          el('div', { class: 'media-name', title: item.path }, [item.name]),
          el('div', { class: 'media-sub' }, [
            `${item.width && item.height ? `${item.width}×${item.height} · ` : ''}${formatSize(item.size)} · ${item.path}`,
          ]),
        ]),
      ])
    }

    async function scan() {
      try {
        const res = await api.mediaUnused(scope)
        items = res.unused
        checked = new Set(items.map((i) => i.path))
        listEl.textContent = ''
        if (!items.length) listEl.append(el('div', { class: 'media-detail-muted' }, ['这个范围里没有未引用的图片。']))
        else for (const item of items) listEl.append(row(item))
        syncSummary()
      } catch (e) {
        listEl.textContent = ''
        listEl.append(el('div', { class: 'media-detail-muted' }, [(e as Error).message]))
        summary.textContent = ''
      }
    }

    async function doDelete() {
      const paths = items.filter((i) => checked.has(i.path))
      if (!paths.length) return
      if (!window.confirm(`确定删除 ${paths.length} 张未被引用的图片？\n此操作不可恢复。`)) return
      deleteBtn.disabled = true
      let ok = 0
      const failed: string[] = []
      for (const item of paths) {
        try {
          await api.mediaRemove(scope, item.path)
          ok++
        } catch (e) {
          failed.push(`${item.path}：${(e as Error).message}`)
        }
      }
      toast(failed.length ? `成功 ${ok} 张，失败 ${failed.length} 张` : `已删除 ${ok} 张图片`, failed.length ? 'error' : 'info')
      close()
      await load()
    }

    await scan()
  }

  // ---------------- 上传弹窗（图床） ----------------

  async function openUploadModal(opts: { scope: MediaScope; dir?: string; files?: File[] }) {
    let targetScope: MediaScope = opts.scope
    let targetDirValue = ''
    let uploading = false
    let seq = 0
    let quality = 82
    let estimateTimer = 0
    let estimateSeq = 0
    let estimating = false
    const queue: QueueItem[] = []
    const results: UploadResult[] = []
    const estimates = new Map<number, MediaEstimate>()
    const estimateCache = new Map<string, MediaEstimate>()

    // 目标选择
    const targetSelect: SelectControl = createSelect({
      id: 'upload-target',
      title: '上传到哪个目录',
      options: [{ value: '', label: '加载中…' }],
      search: true,
      searchPlaceholder: '搜索文章标题或目录…',
      onChange: (value: string) => {
        targetDirValue = value
        syncTargetHint()
      },
    })

    const blogTab = el('button', { class: 'media-tab', type: 'button' }, ['博客文章'])
    const publicTab = el('button', { class: 'media-tab', type: 'button' }, ['public'])
    const targetHint = el('div', { class: 'media-target-hint' })

    function finalDir() {
      if (targetScope === 'blog') return targetDirValue ? `${targetDirValue}/images` : ''
      return targetDirValue
    }

    function syncTargetHint() {
      const dir = finalDir()
      const base = targetScope === 'blog' ? 'src/content/blog/' : 'public/'
      targetHint.textContent = dir
        ? `保存到 ${base}${dir}/`
        : targetScope === 'blog'
          ? '请选择一篇文章作为上传目标'
          : '保存到 public/ 根目录'
    }

    function syncTargets(preselect?: string) {
      const list = state.list
      if (targetScope === 'blog') {
        const articles: MediaArticleTarget[] = list?.articles ?? []
        targetSelect.setOptions(
          articles.length
            ? articles.map((a) => ({ value: a.dir, label: a.title ? `${a.title}（${a.dir}）` : a.dir }))
            : [{ value: '', label: '还没有文章，请先新建一篇文章' }],
          preselect && articles.some((a) => a.dir === preselect) ? preselect : articles[0]?.dir ?? '',
        )
      } else {
        const dirs = list?.dirs ?? []
        targetSelect.setOptions(
          [{ value: '', label: 'public 根目录' }, ...dirs.map((d) => ({ value: d, label: d }))],
          preselect ?? '',
        )
      }
      targetDirValue = targetSelect.value
      blogTab.classList.toggle('active', targetScope === 'blog')
      publicTab.classList.toggle('active', targetScope === 'public')
      syncTargetHint()
      syncFooter()
    }

    blogTab.addEventListener('click', () => {
      if (uploading) return
      targetScope = 'blog'
      syncTargets(opts.dir)
    })
    publicTab.addEventListener('click', () => {
      if (uploading) return
      targetScope = 'public'
      syncTargets()
    })

    // 压缩质量 + 预估大小（与上传使用同一套 sharp 参数）
    const qualityValue = el('span', { class: 'media-quality-value' }, ['82'])
    const estimateSummary = el('div', { class: 'media-estimate-summary' }, ['添加图片后显示压缩后的预估大小'])
    const qualityInput = el('input', {
      class: 'media-quality-range',
      type: 'range',
      min: '40',
      max: '100',
      step: '1',
      value: '82',
      'aria-label': '压缩质量',
      oninput: () => applyQuality(),
    }) as HTMLInputElement
    const qualityBox = el('div', { class: 'media-compress' }, [
      el('div', { class: 'media-compress-head' }, [
        el('span', { class: 'media-compress-label' }, ['压缩质量']),
        qualityValue,
      ]),
      qualityInput,
      el('div', { class: 'modal-hint' }, [
        'JPEG / WebP / AVIF 按质量重编码；PNG 低于 100 时启用调色板压缩（100 = 无损）；GIF / SVG 原样保存。',
      ]),
      estimateSummary,
    ])

    function applyQuality() {
      quality = Math.min(100, Math.max(40, Number(qualityInput.value) || 82))
      qualityValue.textContent = String(quality)
      // 掉质量后旧预估作废，避免 320ms 防抖窗口里还显示上一档的大小
      estimateSeq++
      for (const item of queue) if (item.status === 'pending') estimates.delete(item.id)
      if (!queue.some((item) => item.status === 'pending')) estimating = false
      scheduleEstimate()
      updateEstimateSummary()
    }

    function estimateKey(item: QueueItem) {
      return `${item.file.name}:${item.file.size}:${item.file.lastModified}:${quality}`
    }

    function scheduleEstimate(delay = 320) {
      clearTimeout(estimateTimer)
      if (!queue.some((q) => q.status === 'pending')) return
      // 防抖窗口里也显示「预估中」，避免刚拖入图片时闪一下「失败」
      estimating = true
      updateEstimateSummary()
      estimateTimer = window.setTimeout(() => void runEstimate(), delay)
    }

    // 逐个问服务端要「压缩后大小」：只读内存、不写盘，所以预估与真正上传的结果一致
    async function runEstimate() {
      const pending = queue.filter((q) => q.status === 'pending')
      if (!pending.length || uploading) return
      const run = ++estimateSeq
      estimating = true
      renderQueue()
      updateEstimateSummary()
      syncFooter()
      for (const item of pending) {
        const key = estimateKey(item)
        const cached = estimateCache.get(key)
        if (cached) {
          estimates.set(item.id, cached)
          continue
        }
        try {
          const res = await api.mediaEstimate(item.file, quality)
          if (run !== estimateSeq) return
          estimateCache.set(key, res)
          estimates.set(item.id, res)
        } catch {
          if (run !== estimateSeq) return
          estimates.delete(item.id)
        }
        renderQueue()
        updateEstimateSummary()
      }
      if (run !== estimateSeq) return
      estimating = false
      renderQueue()
      updateEstimateSummary()
      syncFooter()
    }

    function updateEstimateSummary() {
      const pending = queue.filter((q) => q.status === 'pending')
      if (!pending.length) {
        estimateSummary.textContent = '添加图片后显示压缩后的预估大小'
        estimateSummary.classList.remove('is-ready')
        return
      }
      const ready = pending
        .map((q) => estimates.get(q.id))
        .filter((e): e is MediaEstimate => !!e)
      if (estimating) {
        estimateSummary.textContent = `正在预估压缩后大小…（${ready.length}/${pending.length}）`
        estimateSummary.classList.remove('is-ready')
        return
      }
      if (ready.length < pending.length) {
        estimateSummary.textContent = `有 ${pending.length - ready.length} 张图片无法预估，将按原图大小上传`
        estimateSummary.classList.remove('is-ready')
        return
      }
      const totalSize = ready.reduce((sum, e) => sum + e.size, 0)
      const totalOriginal = ready.reduce((sum, e) => sum + e.originalSize, 0)
      const saved = totalOriginal > 0 ? Math.round((1 - totalSize / totalOriginal) * 100) : 0
      estimateSummary.textContent =
        `预估 ${pending.length} 张 · ${formatSize(totalSize)}` +
        `（原始 ${formatSize(totalOriginal)}${saved > 0 ? `，-${saved}%` : ''}）`
      estimateSummary.classList.add('is-ready')
    }

    // 拖拽区
    const fileInput = el('input', { type: 'file', accept: 'image/*', multiple: true }) as HTMLInputElement
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', () => {
      addFiles([...(fileInput.files || [])])
      fileInput.value = ''
    })
    const dropBox = el('div', {
      class: 'media-dropzone',
      role: 'button',
      tabindex: '0',
      onclick: () => fileInput.click(),
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          fileInput.click()
        }
      },
    }, [
      el('div', { class: 'media-dropzone-icon' }, ['⬆']),
      el('div', { class: 'media-dropzone-title' }, ['把图片拖到这里，或点击选择文件']),
      el('div', { class: 'media-dropzone-sub' }, ['支持多张，自动压缩长边超过 2400px 的图片，重复图片会提示复用']),
      fileInput,
    ])

    let dragDepth = 0
    dropBox.addEventListener('dragenter', (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragDepth++
      dropBox.classList.add('is-drag')
    })
    dropBox.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    })
    dropBox.addEventListener('dragleave', (e) => {
      e.stopPropagation()
      dragDepth = Math.max(0, dragDepth - 1)
      if (!dragDepth) dropBox.classList.remove('is-drag')
    })
    dropBox.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragDepth = 0
      dropBox.classList.remove('is-drag')
      addFiles([...(e.dataTransfer?.files || [])])
    })

    // 队列与结果
    const queueEl = el('div', { class: 'media-queue' })
    const resultEl = el('div', { class: 'media-results' })

    // 外链
    const urlInput = el('input', { class: 'input', placeholder: 'https://example.com/a.png' })
    const altInput = el('input', { class: 'input', placeholder: 'alt 文本（可选）' })
    const addUrlBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      onclick: () => addExternal(),
    }, ['添加外链'])
    const externalBox = el('details', { class: 'media-external' }, [
      el('summary', {}, ['已在外部的图片？粘贴图片链接']),
      el('div', { class: 'media-external-row' }, [urlInput, altInput, addUrlBtn]),
      el('div', { class: 'modal-hint' }, ['只是生成 Markdown 引用，不会下载或保存到本地。']),
    ])

    // 底部按钮
    const submitBtn = el('button', {
      class: 'btn btn-primary',
      type: 'button',
      disabled: true,
      onclick: () => void startUpload(),
    }, ['上传'])
    const cancelBtn = el('button', { class: 'btn', type: 'button' }, ['关闭'])

    function addFiles(files: File[]) {
      if (uploading) return
      const images = files.filter(isImageFile)
      if (images.length !== files.length) toast('只能上传图片文件', 'error')
      for (const file of images) {
        // 同名同大小同修改时间视为同一张，避免重复拖入
        if (queue.some((q) => q.name === file.name && q.size === file.size && q.file.lastModified === file.lastModified)) continue
        queue.push({
          id: ++seq,
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          status: 'pending',
        })
      }
      renderQueue()
      syncFooter()
      updateEstimateSummary()
      scheduleEstimate()
    }

    function renderQueue() {
      queueEl.textContent = ''
      for (const item of queue) {
        const estimate = estimates.get(item.id)
        const statusParts: string[] = []
        if (item.error) {
          statusParts.push(`${STATUS_TEXT[item.status]}：${item.error}`)
        } else {
          statusParts.push(STATUS_TEXT[item.status])
          if (item.status === 'pending') {
            if (estimate) {
              const saved = estimate.originalSize > 0
                ? Math.round((1 - estimate.size / estimate.originalSize) * 100)
                : 0
              statusParts.push(
                `${formatSize(item.size)} → 预计 ${formatSize(estimate.size)}` +
                  (estimate.compressed && saved > 0 ? `（-${saved}%）` : '（不压缩）'),
              )
            } else if (estimating) {
              statusParts.push(`${formatSize(item.size)} · 预估中…`)
            } else {
              statusParts.push(formatSize(item.size))
            }
          } else if (item.status === 'done' && item.result) {
            statusParts.push(`${formatSize(item.result.size)}${item.result.compressed ? '（已压缩）' : '（原样）'}`)
          } else if (item.status === 'duplicate' && item.result) {
            statusParts.push(item.result.path)
          }
        }
        const removeBtn = el('button', {
          class: 'media-queue-remove',
          type: 'button',
          title: '从列表移除',
          disabled: uploading || item.status === 'uploading',
          onclick: (e: Event) => {
            e.stopPropagation()
            const i = queue.indexOf(item)
            if (i >= 0) queue.splice(i, 1)
            estimates.delete(item.id)
            URL.revokeObjectURL(item.url)
            renderQueue()
            syncFooter()
            updateEstimateSummary()
            scheduleEstimate()
          },
        }, ['×'])
        queueEl.append(
          el('div', { class: `media-queue-row is-${item.status}` }, [
            el('img', { class: 'media-queue-thumb', src: item.url, alt: item.name }),
            el('div', { class: 'media-queue-info' }, [
              el('div', { class: 'media-queue-name', title: item.name }, [item.name]),
              el('div', { class: 'media-queue-status' }, [statusParts.join(' · ')]),
            ]),
            removeBtn,
          ]),
        )
      }
    }

    function pushResult(item: MediaItem, scope: MediaScope, note: string) {
      results.unshift({
        key: `${item.path}:${results.length}`,
        name: item.name,
        url: item.url,
        markdown: markdownFor(item, scope),
        path: item.path,
        note,
      })
      renderResults()
    }

    function addExternal() {
      const url = urlInput.value.trim()
      if (!/^https?:\/\/\S+$/i.test(url)) {
        toast('请输入 http(s) 开头的图片地址', 'error')
        return
      }
      const name = stripExt(url.split('/').pop() || 'image')
      const alt = altInput.value.trim() || name
      results.unshift({
        key: `external:${Date.now()}:${results.length}`,
        name,
        url,
        markdown: `![${alt}](${url})`,
        path: '',
        note: '外链',
      })
      urlInput.value = ''
      altInput.value = ''
      renderResults()
    }

    function renderResults() {
      resultEl.textContent = ''
      if (!results.length) {
        resultEl.hidden = true
        return
      }
      resultEl.hidden = false
      resultEl.append(el('div', { class: 'media-results-title' }, ['可复制的引用']))
      for (const item of results) {
        const img = el('img', { class: 'media-result-thumb', src: item.url, alt: item.name })
        img.addEventListener('error', () => img.classList.add('is-broken'))
        const actions: HTMLElement[] = [
          el('button', {
            class: 'btn btn-sm',
            type: 'button',
            onclick: () => copyText(item.markdown, '已复制 Markdown 片段'),
          }, ['复制 MD']),
        ]
        if (item.path) {
          actions.push(el('button', {
            class: 'btn btn-sm',
            type: 'button',
            onclick: () => copyText(item.path, '已复制路径'),
          }, ['复制路径']))
        }
        resultEl.append(
          el('div', { class: 'media-result-row' }, [
            img,
            el('div', { class: 'media-result-info' }, [
              el('div', { class: 'media-result-name' }, [item.name]),
              el('code', { class: 'media-result-md' }, [item.markdown]),
              el('div', { class: 'media-result-note' }, [item.note]),
            ]),
            el('div', { class: 'media-result-actions' }, actions),
          ]),
        )
      }
    }

    function syncFooter() {
      const pending = queue.filter((q) => q.status === 'pending').length
      submitBtn.textContent = uploading ? '上传中…' : pending ? `上传 ${pending} 张` : '上传'
      submitBtn.disabled = uploading || pending === 0 || (targetScope === 'blog' && !finalDir())
      blogTab.disabled = uploading
      publicTab.disabled = uploading
      targetSelect.disabled = uploading
      qualityInput.disabled = uploading
    }

    async function startUpload() {
      if (uploading) return
      const scopeAtStart = targetScope
      const dir = finalDir()
      if (scopeAtStart === 'blog' && !dir) {
        toast('请选择要上传到的文章', 'error')
        return
      }
      const pending = queue.filter((q) => q.status === 'pending')
      if (!pending.length) return
      // 上传一开始就锁定质量，并取消还在跑的预估
      clearTimeout(estimateTimer)
      estimateSeq++
      estimating = false
      const qualityAtStart = quality
      uploading = true
      syncFooter()
      renderQueue()
      for (const item of pending) {
        item.status = 'uploading'
        renderQueue()
        try {
          const res = await api.mediaUpload(item.file, scopeAtStart, dir, qualityAtStart)
          if (res.duplicate) {
            item.status = 'duplicate'
            item.result = res.duplicate
            pushResult(res.duplicate, scopeAtStart, '内容重复，已复用已有图片')
            showDuplicate(res.duplicate)
          } else {
            item.status = 'done'
            item.result = res
            pushResult(res, scopeAtStart, res.compressed ? '已上传（已压缩）' : '已上传（原样保存）')
          }
        } catch (e) {
          item.status = 'error'
          item.error = (e as Error).message
        }
        renderQueue()
      }
      uploading = false
      await load()
      syncFooter()
      updateEstimateSummary()
    }

    // 组装弹窗
    const { overlay, close } = createOverlay(
      'media-upload',
      () => {
        clearTimeout(estimateTimer)
        estimateSeq++
        for (const item of queue) URL.revokeObjectURL(item.url)
      },
      () => {
        if (!uploading) return true
        return window.confirm('正在上传，确定关闭弹窗？')
      },
    )

    cancelBtn.addEventListener('click', () => close())

    overlay.append(
      el('div', { class: 'media-dialog media-upload-dialog' }, [
        el('h2', { class: 'modal-title' }, ['上传图片']),
        el('div', { class: 'media-upload-target' }, [
          el('label', { class: 'modal-field' }, [
            '上传到',
            el('div', { class: 'media-tabs' }, [blogTab, publicTab]),
          ]),
          el('div', { class: 'media-upload-target-select' }, [targetSelect]),
          targetHint,
        ]),
        qualityBox,
        dropBox,
        queueEl,
        externalBox,
        resultEl,
        el('div', { class: 'modal-actions' }, [cancelBtn, submitBtn]),
      ]),
    )
    root.append(overlay)

    syncTargets(opts.dir)
    // 从「上传到这里」或整页拖拽打开时预先塞入文件
    if (opts.files?.length) addFiles(opts.files)
    if (!state.list) void load().then(() => syncTargets(opts.dir))
    dropBox.focus()
  }

  // ---------------- 整页拖拽：直接打开上传弹窗 ----------------

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
    const files = [...(e.dataTransfer?.files || [])].filter(isImageFile)
    if (files.length) openUploadModal({ scope: state.scope, files })
    else toast('只能上传图片文件', 'error')
  })

  selectAllBox.addEventListener('change', () => toggleAll(selectAllBox.checked))

  await load()

  ;(root as AppRoot).__cleanup = () => {
    clearTimeout(timer)
    loadSeq++
    // 弹窗里可能有未结束的上传与 blob 预览，换路由时强制关闭
    closeActiveOverlays()
  }
}
