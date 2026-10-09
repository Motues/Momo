import { api } from '../api'
import type { ArticleSummary } from '../types'
import { navigate } from '../router'
import { el, encodePath } from '../dom'
import { createSelect, type SelectControl } from '../select'
import { toast } from '../ui'
import { pageHeader } from './header'
import { openNewModal } from './new-article'

type ViewMode = 'card' | 'table'

const VIEW_KEY = 'cms-list-view'

interface AppRoot extends HTMLElement {
  __cleanup?: () => void
}

interface ListState {
  q: string
  category: string
  draft: string
  categories: string[]
  view: ViewMode
  sort: string
  articles: ArticleSummary[]
}

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'card'
  } catch {
    return 'card'
  }
}

export async function renderList(root: HTMLElement) {
  const state: ListState = {
    q: '',
    category: '',
    draft: 'all',
    categories: [],
    view: loadView(),
    sort: 'default',
    articles: [],
  }

  root.append(
    pageHeader(
      'list',
      el('button', { class: 'btn btn-primary', id: 'btn-new', onclick: () => openNewModal(root, state.categories) }, [
        '＋ 新建文章',
      ]),
    ),
    el('main', { class: 'cms-main' }, [
      el('div', { class: 'cms-toolbar' }, [
        el('input', {
          class: 'input input-search',
          type: 'search',
          placeholder: '搜索标题 / 描述 / 路径 / 分类…',
          oninput: (e: Event) => {
            state.q = (e.target as HTMLInputElement).value
            debouncedReload()
          },
        }),
        createSelect({
          id: 'filter-category',
          // 先占位再等 /api/meta 填真实分类，避免加载完成前宽度跳一下
          options: [{ value: '', label: '全部分类' }],
          onChange: (v: string) => {
            state.category = v
            reload()
          },
        }),
        createSelect({
          id: 'filter-draft',
          options: [
            { value: 'all', label: '全部状态' },
            { value: 'published', label: '已发布' },
            { value: 'drafts', label: '草稿' },
          ],
          onChange: (v: string) => {
            state.draft = v
            reload()
          },
        }),
        createSelect({
          id: 'sort-by',
          title: '排序方式',
          options: [
            { value: 'default', label: '默认（置顶+日期）' },
            { value: 'date-desc', label: '发布日期 新→旧' },
            { value: 'date-asc', label: '发布日期 旧→新' },
            { value: 'title-asc', label: '标题 A→Z' },
            { value: 'title-desc', label: '标题 Z→A' },
            { value: 'path-asc', label: '路径 A→Z' },
            { value: 'path-desc', label: '路径 Z→A' },
            { value: 'category-asc', label: '分类 A→Z' },
          ],
          onChange: (v: string) => {
            state.sort = v
            renderListItems(state.articles)
          },
        }),
        el('div', { class: 'view-toggle', role: 'group', title: '切换视图模式' }, [
          el('button', {
            class: 'view-btn' + (state.view === 'card' ? ' active' : ''),
            id: 'view-card',
            onclick: () => setView('card'),
          }, ['卡片']),
          el('button', {
            class: 'view-btn' + (state.view === 'table' ? ' active' : ''),
            id: 'view-table',
            onclick: () => setView('table'),
          }, ['表格']),
        ]),
        el('span', { class: 'cms-count', id: 'count' }),
      ]),
      el('div', { class: 'article-list' + (state.view === 'table' ? ' is-table' : ''), id: 'article-list' }),
      el('div', { class: 'cms-empty', id: 'empty', hidden: true }, [
        '暂无文章，点击右上角「新建文章」开始创作',
      ]),
    ]),
  )

  let timer = 0
  function debouncedReload() {
    clearTimeout(timer)
    timer = window.setTimeout(reload, 250)
  }

  function setView(view: ViewMode) {
    state.view = view
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      /* localStorage 不可用时忽略 */
    }
    const cardBtn = root.querySelector('#view-card') as HTMLButtonElement | null
    const tableBtn = root.querySelector('#view-table') as HTMLButtonElement | null
    if (cardBtn) cardBtn.classList.toggle('active', view === 'card')
    if (tableBtn) tableBtn.classList.toggle('active', view === 'table')
    const listEl = root.querySelector('#article-list') as HTMLElement
    listEl.classList.toggle('is-table', view === 'table')
    renderListItems(state.articles)
  }

  async function reload() {
    try {
      const { articles } = await api.list({
        q: state.q,
        category: state.category,
        draft: state.draft,
      })
      state.articles = articles
      renderListItems(articles)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  function renderListItems(articles: ArticleSummary[]) {
    const sorted = sortArticles(articles, state.sort)
    const listEl = root.querySelector('#article-list') as HTMLElement
    const emptyEl = root.querySelector('#empty') as HTMLElement
    const countEl = root.querySelector('#count') as HTMLElement
    listEl.innerHTML = ''
    emptyEl.hidden = sorted.length > 0
    countEl.textContent = `共 ${sorted.length} 篇`
    if (state.view === 'table') {
      const wrap = articleTable(sorted, () => reload())
      listEl.append(wrap)
      fitTableColumns(wrap)
    } else for (const a of sorted) listEl.append(articleCard(a))
  }

  async function loadMeta() {
    try {
      const meta = await api.meta()
      state.categories = meta.categories.map((c) => c.name)
      const sel = root.querySelector('#filter-category') as SelectControl | null
      sel?.setOptions([
        { value: '', label: '全部分类' },
        ...meta.categories.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })),
      ])
    } catch {
      /* meta 加载失败不影响列表 */
    }
  }

  await Promise.all([loadMeta(), reload()])

  // 窗口尺寸变化后重新按内容分配列宽
  let fitRaf = 0
  const onWindowResize = () => {
    cancelAnimationFrame(fitRaf)
    fitRaf = requestAnimationFrame(() => {
      const wrap = root.querySelector('.table-wrap') as HTMLElement | null
      if (wrap) fitTableColumns(wrap)
    })
  }
  window.addEventListener('resize', onWindowResize)
  ;(root as AppRoot).__cleanup = () => {
    window.removeEventListener('resize', onWindowResize)
    cancelAnimationFrame(fitRaf)
  }
}

// ---------------- 排序 ----------------

// 中文排序（拼音 + 数字感知）；sensitivity: base 忽略大小写与变音
const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

function sortArticles(articles: ArticleSummary[], sort: string): ArticleSummary[] {
  const list = [...articles]
  const titleKey = (a: ArticleSummary) => a.title || a.path || ''

  // 日期排序：无日期的文章恒排末尾，再按方向比较，最后用路径兜底保证稳定
  const byDate = (a: ArticleSummary, b: ArticleSummary, dir: 1 | -1) => {
    const da = a.pubDate || ''
    const db = b.pubDate || ''
    if (!da && !db) return collator.compare(a.path, b.path)
    if (!da) return 1
    if (!db) return -1
    return dir * da.localeCompare(db) || collator.compare(a.path, b.path)
  }

  switch (sort) {
    case 'date-asc':
      return list.sort((a, b) => byDate(a, b, 1))
    case 'date-desc':
      return list.sort((a, b) => byDate(a, b, -1))
    case 'title-asc':
      return list.sort((a, b) => collator.compare(titleKey(a), titleKey(b)) || collator.compare(a.path, b.path))
    case 'title-desc':
      return list.sort((a, b) => collator.compare(titleKey(b), titleKey(a)) || collator.compare(a.path, b.path))
    case 'path-asc':
      return list.sort((a, b) => collator.compare(a.path, b.path))
    case 'path-desc':
      return list.sort((a, b) => collator.compare(b.path, a.path))
    case 'category-asc':
      return list.sort(
        (a, b) =>
          collator.compare(a.category || '', b.category || '') || collator.compare(titleKey(a), titleKey(b)),
      )
    default:
      // 默认：置顶优先，其次发布日期倒序，最后路径兜底
      return list.sort(
        (a, b) =>
          (b.pinTop - a.pinTop) ||
          (b.pubDate || '').localeCompare(a.pubDate || '') ||
          collator.compare(a.path, b.path),
      )
  }
}

// ---------------- 卡片视图 ----------------

function articleCard(a: ArticleSummary) {
  const badges: (HTMLElement | string)[] = []
  if (a.draft) badges.push(el('span', { class: 'badge badge-draft' }, ['草稿']))
  if (a.pinTop) badges.push(el('span', { class: 'badge badge-pin' }, ['置顶']))
  for (const lang of a.langs) badges.push(el('span', { class: 'badge badge-lang' }, [lang]))

  return el('a', { class: 'article-card', href: `#/edit/${encodePath(a.path)}` }, [
    el('div', { class: 'article-card-head' }, [
      el('span', { class: 'article-card-title' }, [a.title || a.path]),
      el('div', { class: 'article-card-badges' }, badges),
    ]),
    el('div', { class: 'article-card-meta' }, [
      a.category ? el('span', { class: 'tag' }, [a.category]) : null,
      el('span', {}, [a.pubDate || '—']),
      el('span', { class: 'article-card-path' }, [a.path]),
    ]),
    a.description ? el('p', { class: 'article-card-desc' }, [a.description]) : null,
  ])
}

// ---------------- 表格视图 ----------------

// 列定义：min/max 为列宽自适应时的下限与上限（px），列宽由 fitTableColumns 按内容分配
const TABLE_COLUMNS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'title', label: '标题', min: 200, max: 520 },
  { key: 'category', label: '分类', min: 88, max: 160 },
  { key: 'status', label: '状态', min: 104, max: 132 },
  { key: 'langs', label: '语言', min: 106, max: 150 },
  { key: 'date', label: '日期', min: 96, max: 124 },
  { key: 'path', label: '路径', min: 150, max: 340 },
  { key: 'actions', label: '操作', min: 110, max: 118 },
]

function articleTable(articles: ArticleSummary[], onChanged: () => void) {
  const tbody = el('tbody')
  for (const a of articles) tbody.append(articleRow(a, onChanged))
  const table = el('table', { class: 'article-table' }, [
    el('colgroup', {}, TABLE_COLUMNS.map((c) => el('col', { class: `col-${c.key}` }))),
    el('thead', {}, [
      el('tr', {}, TABLE_COLUMNS.map((c) =>
        c.key === 'actions'
          ? el('th', { class: 'actions' }, [c.label])
          : el('th', {}, [c.label]),
      )),
    ]),
    tbody,
  ])
  return el('div', { class: 'table-wrap' }, [table])
}

// 列宽自适应：先量出每列内容的自然宽度，再在容器宽度内分配，
// 使表格既贴合内容（不浪费空间）又铺满整行；可伸缩列主要是标题与路径。
function fitTableColumns(wrap: HTMLElement) {
  const table = wrap.querySelector<HTMLTableElement>('table.article-table')
  if (!table) return
  const cols = Array.from(table.querySelectorAll<HTMLTableColElement>('colgroup > col'))
  const heads = Array.from(table.querySelectorAll<HTMLElement>('thead > tr > th'))
  if (cols.length !== TABLE_COLUMNS.length || heads.length !== TABLE_COLUMNS.length) return

  // 临时取消宽度约束，让浏览器按内容（不换行）排一次，量出各列自然宽度
  table.style.tableLayout = 'auto'
  table.style.width = 'max-content'
  for (const col of cols) col.style.width = ''
  const measured = heads.map((th) => th.getBoundingClientRect().width)
  // 拿不到布局信息时（如非浏览器环境）恢复浏览器默认的自动布局
  if (!measured.some((w) => w > 0)) {
    table.style.tableLayout = ''
    table.style.width = ''
    table.style.minWidth = ''
    return
  }
  const natural = measured.map((w, i) =>
    Math.min(Math.max(w, TABLE_COLUMNS[i].min), TABLE_COLUMNS[i].max),
  )

  const mins = TABLE_COLUMNS.map((c) => c.min)
  const totalMin = mins.reduce((a, b) => a + b, 0)
  const totalNatural = natural.reduce((a, b) => a + b, 0)
  // 容器比最小列宽之和还窄时，表格保持最小宽度，由 .table-wrap 横向滚动
  const available = Math.max(wrap.clientWidth || totalNatural, totalMin)

  let widths: number[]
  if (totalNatural <= available) {
    // 内容比容器窄：按内容比例摊掉多余空间，铺满整行
    const extra = available - totalNatural
    widths = natural.map((w) => w + (extra * w) / totalNatural)
  } else {
    // 需要收缩：各列先保底最小宽度，余下空间按“可压缩量”比例分配
    const slack = natural.map((w, i) => Math.max(0, w - mins[i]))
    const totalSlack = slack.reduce((a, b) => a + b, 0)
    const budget = available - totalMin
    widths = natural.map((_, i) => mins[i] + (totalSlack > 0 ? (budget * slack[i]) / totalSlack : 0))
  }

  table.style.minWidth = `${totalMin}px`
  table.style.tableLayout = 'fixed'
  table.style.width = '100%'
  cols.forEach((col, i) => {
    col.style.width = `${(widths[i] / available) * 100}%`
  })
}

function articleRow(a: ArticleSummary, onChanged: () => void) {
  const badges: (HTMLElement | string)[] = []
  if (a.draft) badges.push(el('span', { class: 'badge badge-draft' }, ['草稿']))
  if (a.pinTop) badges.push(el('span', { class: 'badge badge-pin' }, ['置顶']))
  const langs = a.langs.map((l) => el('span', { class: 'badge badge-lang' }, [l]))

  return el('tr', {
    class: 'article-table-row',
    role: 'link',
    tabindex: '0',
    title: `编辑 ${a.path}`,
    onclick: () => navigate(`#/edit/${encodePath(a.path)}`),
    onkeydown: (e: KeyboardEvent) => {
      // 焦点在操作按钮上时 Enter 触发按钮而非跳转
      if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button')) {
        navigate(`#/edit/${encodePath(a.path)}`)
      }
    },
  }, [
    el('td', {}, [
      el('div', { class: 'article-table-title' }, [a.title || a.path]),
      a.description ? el('div', { class: 'article-table-desc' }, [a.description]) : null,
    ]),
    el('td', {}, [a.category ? el('span', { class: 'tag' }, [a.category]) : null]),
    el('td', {}, badges),
    el('td', {}, langs),
    el('td', {}, [a.pubDate || '—']),
    el('td', { class: 'path' }, [a.path]),
    actionsCell(a, onChanged),
  ])
}

// ---------------- 表格行内操作 ----------------

function actionsCell(a: ArticleSummary, onChanged: () => void) {
  const pinBtn = rowActionBtn(
    '<path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    a.pinTop ? '取消置顶' : '置顶',
    a.pinTop ? 'active' : '',
    () => togglePin(a, onChanged),
  )
  const draftBtn = rowActionBtn(
    '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    a.draft ? '标记为已发布' : '标记为草稿',
    a.draft ? 'active' : '',
    () => toggleDraft(a, onChanged),
  )
  const delBtn = rowActionBtn(
    '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    '删除文章',
    'row-act-danger',
    () => doRowDelete(a, onChanged),
  )
  return el('td', { class: 'actions' }, [pinBtn, draftBtn, delBtn])
}

// 行内操作按钮：阻止冒泡，避免触发整行的跳转
function rowActionBtn(iconPath: string, title: string, cls: string, onClick: () => void) {
  const span = document.createElement('span')
  span.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPath}</svg>`
  return el('button', {
    class: `row-act ${cls}`.trim(),
    title,
    type: 'button',
    onclick: (e: Event) => {
      e.stopPropagation()
      onClick()
    },
  }, [span])
}

// 切换置顶 / 草稿：写入该文章全部语言版本的 frontmatter
async function setFlag(
  a: ArticleSummary,
  key: 'pinTop' | 'draft',
  value: number | boolean,
  onChanged: () => void,
  onMsg: string,
  offMsg: string,
) {
  try {
    const detail = await api.get(a.path)
    for (const lang of Object.keys(detail.files)) {
      const f = detail.files[lang]
      ;(f.data as Record<string, unknown>)[key] = value
      await api.save(a.path, lang, { data: f.data, body: f.content })
    }
    toast(value ? onMsg : offMsg)
    onChanged()
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

function togglePin(a: ArticleSummary, onChanged: () => void) {
  return setFlag(a, 'pinTop', a.pinTop ? 0 : 1, onChanged, '已置顶', '已取消置顶')
}

function toggleDraft(a: ArticleSummary, onChanged: () => void) {
  return setFlag(a, 'draft', !a.draft, onChanged, '已标记为草稿', '已发布')
}

async function doRowDelete(a: ArticleSummary, onChanged: () => void) {
  if (!window.confirm(`确定删除文章「${a.title || a.path}」？\n将删除整个文件夹及其所有语言版本，不可恢复。`)) {
    return
  }
  try {
    await api.remove(a.path)
    toast('已删除')
    onChanged()
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}
