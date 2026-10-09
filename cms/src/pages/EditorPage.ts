import { api } from '../api'
import type { ArticleDetail, FrontmatterData } from '../types'
import { navigate } from '../router'
import { el, encodePath, escapeHtml } from '../dom'
import { createSelect } from '../select'
import { toast } from '../ui'

interface EditorState {
  path: string
  lang: string
  detail: ArticleDetail
  data: FrontmatterData
  body: string
  snapshot: string
  dirty: boolean
  saving: boolean
  previewTimer: number
  previewSeq: number
}

interface AppRoot extends HTMLElement {
  __cleanup?: () => void
}

// 自动保存间隔（毫秒）：编辑页每 60 秒检查一次，只在有改动且没有保存在进行时写盘
const AUTOSAVE_INTERVAL = 60_000

export async function renderEditor(root: HTMLElement, path: string) {
  let detail: ArticleDetail
  try {
    detail = await api.get(path)
  } catch (e) {
    root.append(el('div', { class: 'cms-error' }, [escapeHtml((e as Error).message)]))
    return
  }

  const langs = Object.keys(detail.files)
  const initialLang = langs.includes('zh-cn') ? 'zh-cn' : langs[0] || 'zh-cn'
  const file = detail.files[initialLang] || { content: '', data: emptyData(detail.path) }

  const state: EditorState = {
    path: detail.path,
    lang: initialLang,
    detail,
    data: { ...file.data },
    body: file.content,
    snapshot: '',
    dirty: false,
    saving: false,
    previewTimer: 0,
    previewSeq: 0,
  }
  state.snapshot = makeSnapshot(state)

  buildShell(root, state)
  syncForm(state)
  bindTabs(state)
  schedulePreview(state, true)
}

function emptyData(path: string): FrontmatterData {
  const today = new Date().toISOString().slice(0, 10)
  return {
    title: path.split('/').pop() || '未命名',
    pubDate: today,
    description: '',
    image: '',
    draft: true,
    slugId: path,
    category: '',
    pinTop: 0,
  }
}

function makeSnapshot(state: EditorState) {
  return JSON.stringify({ data: state.data, body: state.body })
}

// ---------------- 快速插入工具栏 ----------------

interface InsertTool {
  label: string
  title: string
  // 包裹选中文本：[前缀, 后缀]；无选中时光标落在中间
  wrap?: [string, string]
  // 插入模板：{sel} 替换为选中文本，{cur} 为无选中时的光标落点
  template?: string
}

function buildToolbar(getMd: () => HTMLTextAreaElement | null): HTMLElement {  const noteSelect = createSelect({
    class: 'tool-select',
    title: '提示块类型',
    options: [
      { value: 'note', label: 'note' },
      { value: 'tip', label: 'tip' },
      { value: 'important', label: 'important' },
      { value: 'caution', label: 'caution' },
      { value: 'warning', label: 'warning' },
    ],
  })
  const btn = (t: InsertTool) =>
    el('button', { class: 'tool-btn', title: t.title, onclick: () => applyTool(getMd(), t) }, [t.label])
  const sep = () => el('span', { class: 'tool-sep' })

  return el('div', { class: 'editor-toolbar' }, [
    btn({ label: '加粗', title: '加粗 **文字**', wrap: ['**', '**'] }),
    btn({ label: '斜体', title: '斜体 *文字*', wrap: ['*', '*'] }),
    btn({ label: '代码', title: '行内代码 `code`', wrap: ['`', '`'] }),
    btn({ label: '链接', title: '链接 [文字](https://…)', template: '[{sel}]({cur}https://)' }),
    btn({ label: '图片', title: '图片 ![描述](./图片.png)', template: '![{sel}]({cur}./图片.png)' }),
    btn({ label: '引用', title: '居中引用 ::quote[内容]', wrap: ['::quote[', ']'] }),
    sep(),
    btn({ label: '代码块', title: '代码块 ```lang', wrap: ['```\n', '\n```'] }),
    btn({ label: 'Typst', title: 'Typst 代码块 ```typst', wrap: ['```typst\n', '\n```'] }),
    sep(),
    btn({ label: '公式', title: '行内公式 $…$', wrap: ['$', '$'] }),
    btn({ label: '块公式', title: '块公式 $$…$$', wrap: ['$$\n', '\n$$'] }),
    sep(),
    noteSelect,
    el('button', {
      class: 'tool-btn',
      title: '提示块 :::note{name="提示"} 内容 :::（上方下拉选择类型）',
      onclick: () => applyTool(getMd(), { template: `:::${noteSelect.value}{name="提示"}\n{sel}{cur}{ph:内容}\n:::` }),
    }, ['提示块']),
    btn({ label: 'GitHub', title: 'GitHub 仓库卡片 ::github{repo="owner/repo"}', template: '::github{repo="{cur}owner/repo"}' }),
    btn({ label: '音乐', title: '网易云音乐卡片 ::music{id="歌曲ID"}', template: '::music{id="{cur}歌曲ID"}' }),
    btn({ label: '注音', title: '注音 {中文}(pinyin)', template: '{{sel}中文}({cur}pinyin)' }),
    btn({ label: '模糊', title: '模糊内容（hover 显示）!!文字!!', wrap: ['!!', '!!'] }),
    btn({ label: '彩虹', title: '彩虹文字 ==文字==', wrap: ['==', '=='] }),
    btn({ label: '下划线', title: '下划线 ++文字++', wrap: ['++', '++'] }),
  ])
}

// 在光标处插入 / 包裹选中文本，随后触发 input 事件更新状态与预览
function applyTool(md: HTMLTextAreaElement | null, tool: { wrap?: [string, string]; template?: string }) {
  if (!md) return
  if (!tool.wrap && !tool.template) return
  const start = md.selectionStart
  const end = md.selectionEnd
  const sel = md.value.slice(start, end)

  let text: string
  let caret: number // 插入后光标相对插入文本的偏移
  if (tool.wrap) {
    const [before, after] = tool.wrap
    text = before + sel + after
    caret = sel.length ? text.length : before.length
  } else {
    const t = tool.template as string
    const hasSel = sel.length > 0
    const useSel = t.includes('{sel}')
    // {ph:占位词} 仅在无选中时保留，避免与选中内容叠加；{cur} 用哨兵标记后定位光标
    const sentinel = '\u0000'
    const withCur = t.replace('{sel}', hasSel ? sel : '').replace('{cur}', sentinel)
    const resolved = withCur.replace(/\{ph:([^}]*)\}/g, hasSel ? '' : '$1')
    const curIdx = resolved.indexOf(sentinel)
    text = resolved.replace(sentinel, '')
    caret = hasSel && useSel ? text.length : Math.max(0, curIdx)
  }

  md.setRangeText(text, start, end, 'end')
  md.setSelectionRange(start + caret, start + caret)
  md.focus()
  md.dispatchEvent(new Event('input', { bubbles: true }))
}

// ---------------- 界面骨架 ----------------

function buildShell(root: HTMLElement, state: EditorState) {
  const shell: HTMLDivElement = el('div', { class: 'editor-shell' }, [
    el('header', { class: 'cms-header' }, [
      el('div', { class: 'cms-header-inner editor-header' }, [
        el('button', { class: 'btn', onclick: () => navigate('#/list') }, ['← 文章列表']),
        el('div', { class: 'editor-tabs', id: 'lang-tabs' }),
        el('div', { class: 'editor-actions' }, [
          el('span', { class: 'dirty-badge', id: 'dirty-badge', hidden: true }, ['● 未保存']),
          el('span', { class: 'autosave-hint', id: 'autosave-hint', hidden: true }, ['']),
          el('button', { class: 'btn', id: 'btn-open-blog', title: '在博客中打开当前文章（新标签页）', onclick: () => openInBlog(state) }, ['打开博客']),
          el('button', { class: 'btn', id: 'btn-open-folder', title: '用系统默认的文件管理器打开当前文章所在文件夹', onclick: () => openFolder(state) }, ['📁 打开文件夹']),
          el('button', { class: 'btn', onclick: () => togglePreview() }, ['预览开/关']),
          el('button', { class: 'btn btn-danger', onclick: () => doDelete(state) }, ['删除']),
          el('button', { class: 'btn btn-primary', id: 'btn-save', onclick: () => doSave(state) }, [
            '保存 (Ctrl+S)',
          ]),
        ]),
      ]),
    ]),
    el('main', { class: 'editor-main', id: 'editor-main' }, [
      el('section', { class: 'editor-left' }, [
        el('div', { class: 'form-panel collapsed', id: 'form-panel' }, [
          el('button', {
            class: 'form-toggle',
            id: 'form-toggle',
            title: '展开/收起文章配置',
            onclick: toggleFormPanel,
          }, [
            el('span', { class: 'form-toggle-icon' }, ['⚙']),
            el('span', { class: 'form-toggle-text' }, ['文章配置']),
            el('span', { class: 'form-toggle-arrow' }, ['▾']),
          ]),
          el('div', { class: 'form-grid' }, [
          el('label', { class: 'form-field wide' }, [
            '标题',
            el('input', { class: 'input', id: 'f-title' }),
          ]),
          el('label', { class: 'form-field' }, [
            '日期',
            el('input', { class: 'input', id: 'f-pubdate', type: 'date' }),
          ]),
          el('label', { class: 'form-field' }, [
            '分类',
            el('input', { class: 'input', id: 'f-category', list: 'cms-editor-cats' }),
          ]),
          el('label', { class: 'form-field' }, [
            'slugId',
            el('input', { class: 'input mono', id: 'f-slugid', placeholder: '文章标识，如 momo/xxx（不影响文件夹位置）' }),
          ]),
          el('label', { class: 'form-field wide' }, [
            '封面图',
            el('div', { class: 'form-inline' }, [
              el('input', { class: 'input', id: 'f-image', placeholder: './cover.jpg' }),
              el('button', { class: 'btn btn-sm', id: 'btn-upload', onclick: () => pickFile(state) }, [
                '上传',
              ]),
            ]),
          ]),
          el('label', { class: 'form-field wide' }, [
            '描述',
            el('input', { class: 'input', id: 'f-description' }),
          ]),
          el('label', { class: 'form-check' }, [
            el('input', { type: 'checkbox', id: 'f-draft' }),
            ' 草稿',
          ]),
          el('label', { class: 'form-check' }, [
            el('input', { type: 'checkbox', id: 'f-pintop' }),
            ' 置顶',
          ]),
          ]),
        ]),
        buildToolbar(() => shell.querySelector('#md-editor') as HTMLTextAreaElement | null),
        el('textarea', {
          class: 'md-editor',
          id: 'md-editor',
          spellcheck: false,
          placeholder: '在这里编写 Markdown 正文…\n\n支持博客全部自定义语法：:::note{...}、$公式$、```typst、::github{}、{注音}(かたかな)、!!折叠!!、==彩虹==、++下划线++',
        }),
      ]),
      el('section', { class: 'editor-right', id: 'editor-right' }, [
        el('div', { class: 'preview-bar' }, [
          el('span', { class: 'preview-title' }, ['实时预览']),
          el('span', { class: 'preview-status', id: 'preview-status' }),
        ]),
        el('iframe', {
          class: 'preview-frame',
          id: 'preview-frame',
          sandbox: 'allow-scripts',
          title: '文章预览',
        }),
      ]),
    ]),
  ])
  root.append(shell)

  // 分类候选
  api.meta()
    .then((m) => {
      const dl = el('datalist', { id: 'cms-editor-cats' })
      for (const c of m.categories) dl.append(el('option', { value: c.name }))
      root.append(dl)
    })
    .catch(() => {})

  // 表单 / 编辑器绑定
  bindForm(shell, state)

  // 编辑区与预览区同步滚动
  const offScrollSync = setupScrollSync()

  // Ctrl+S 保存
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      doSave(state)
    }
  }
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (state.dirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  document.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)

  // 自动保存：定时器跟着编辑器界面走，换路由时在 __cleanup 里清掉
  const autosaveTimer = window.setInterval(() => {
    void autoSave(state)
  }, AUTOSAVE_INTERVAL)

  ;(root as AppRoot).__cleanup = () => {
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('beforeunload', onBeforeUnload)
    clearInterval(autosaveTimer)
    offScrollSync()
  }
}

// 折叠 / 展开文章配置表单
function toggleFormPanel() {
  const panel = document.querySelector('#form-panel')
  const arrow = document.querySelector('#form-toggle-arrow')
  if (!panel) return
  panel.classList.toggle('collapsed')
  if (arrow) arrow.textContent = panel.classList.contains('collapsed') ? '▾' : '▴'
}

// 编辑区（textarea）与预览（iframe）按滚动比例双向同步
// 跨源 iframe 只能通过 postMessage 通信：iframe 内部脚本见 preview.mjs
function setupScrollSync(): () => void {
  const textarea = document.querySelector('#md-editor') as HTMLTextAreaElement | null
  const frame = document.querySelector('#preview-frame') as HTMLIFrameElement | null
  if (!textarea || !frame) return () => {}

  const textareaMax = () => textarea.scrollHeight - textarea.clientHeight
  let suppress = false

  const onTextareaScroll = () => {
    if (suppress) return
    const max = textareaMax()
    if (max <= 0) return
    frame.contentWindow?.postMessage(
      { type: 'cms-scroll-to', ratio: textarea.scrollTop / max },
      '*',
    )
  }

  const onMessage = (e: MessageEvent) => {
    const d = e.data
    if (!d || d.type !== 'cms-preview-scroll' || typeof d.ratio !== 'number') return
    const max = textareaMax()
    if (max <= 0) return
    suppress = true
    textarea.scrollTop = Math.round(d.ratio * max)
    // 短暂抑制回环：比例一致后 scroll 事件自然停止
    setTimeout(() => {
      suppress = false
    }, 80)
  }

  textarea.addEventListener('scroll', onTextareaScroll, { passive: true })
  window.addEventListener('message', onMessage)

  return () => {
    textarea.removeEventListener('scroll', onTextareaScroll)
    window.removeEventListener('message', onMessage)
  }
}

// ---------------- 事件绑定 ----------------

function bindForm(shell: HTMLElement, state: EditorState) {
  const on = (id: string, evt: string, fn: (e: Event) => void) => {
    shell.querySelector(`#${id}`)?.addEventListener(evt, fn)
  }
  const textInputs: [string, (v: string) => void][] = [
    ['f-title', (v) => { state.data.title = v; markDirty(state) }],
    ['f-pubdate', (v) => { state.data.pubDate = v; markDirty(state) }],
    ['f-category', (v) => { state.data.category = v; markDirty(state) }],
    ['f-slugid', (v) => { state.data.slugId = v; markDirty(state) }],
    ['f-image', (v) => { state.data.image = v; markDirty(state) }],
    ['f-description', (v) => { state.data.description = v; markDirty(state) }],
  ]
  for (const [id, fn] of textInputs) {
    on(id, 'input', (e) => fn((e.target as HTMLInputElement).value))
  }
  on('f-draft', 'change', (e) => {
    state.data.draft = (e.target as HTMLInputElement).checked
    markDirty(state)
  })
  on('f-pintop', 'change', (e) => {
    state.data.pinTop = (e.target as HTMLInputElement).checked ? 1 : 0
    markDirty(state)
  })
  const md = shell.querySelector('#md-editor') as HTMLTextAreaElement
  md.addEventListener('input', () => {
    state.body = md.value
    markDirty(state)
  })
}

function syncForm(state: EditorState) {
  const set = (id: string, v: string | number | boolean) => {
    const node = document.querySelector(`#${id}`) as HTMLInputElement | null
    if (!node) return
    if (node.type === 'checkbox') node.checked = !!v
    else node.value = String(v ?? '')
  }
  set('f-title', state.data.title)
  set('f-pubdate', state.data.pubDate)
  set('f-category', state.data.category)
  set('f-slugid', state.data.slugId)
  set('f-image', state.data.image)
  set('f-description', state.data.description)
  set('f-draft', state.data.draft)
  set('f-pintop', !!state.data.pinTop)
  const md = document.querySelector('#md-editor') as HTMLTextAreaElement | null
  if (md) md.value = state.body
}

// ---------------- 语言版本切换 ----------------

function bindTabs(state: EditorState) {
  const tabs = document.querySelector('#lang-tabs')
  if (!tabs) return
  tabs.innerHTML = ''
  for (const lang of ['zh-cn', 'en']) {
    const exists = !!state.detail.files[lang]
    tabs.append(
      el('button', {
        class: 'tab' + (lang === state.lang ? ' active' : '') + (exists ? '' : ' tab-new'),
        onclick: () => switchLang(state, lang),
      }, [`${lang}${exists ? '' : ' ＋'}`]),
    )
  }
}

function switchLang(state: EditorState, lang: string) {
  if (lang === state.lang) return
  if (state.dirty && !window.confirm('当前语言版本有未保存的修改，切换将丢弃这些修改，继续？')) return
  state.lang = lang
  const file = state.detail.files[lang]
  state.data = file ? { ...file.data } : emptyData(state.path)
  state.body = file ? file.content : ''
  state.snapshot = makeSnapshot(state)
  state.dirty = false
  const badge = document.querySelector('#dirty-badge') as HTMLElement | null
  if (badge) badge.hidden = true
  // 自动保存时间属于上一个语言版本，切换后不再展示
  const hint = document.querySelector('#autosave-hint') as HTMLElement | null
  if (hint) hint.hidden = true
  syncForm(state)
  bindTabs(state)
  schedulePreview(state, true)
}

// ---------------- 实时预览 ----------------

function markDirty(state: EditorState) {
  state.dirty = makeSnapshot(state) !== state.snapshot
  const badge = document.querySelector('#dirty-badge') as HTMLElement | null
  if (badge) badge.hidden = !state.dirty
  schedulePreview(state)
}

function schedulePreview(state: EditorState, immediate = false) {
  clearTimeout(state.previewTimer)
  state.previewTimer = window.setTimeout(() => renderPreview(state), immediate ? 0 : 500)
}

async function renderPreview(state: EditorState) {
  const frame = document.querySelector('#preview-frame') as HTMLIFrameElement | null
  const status = document.querySelector('#preview-status') as HTMLElement | null
  if (!frame) return
  const seq = ++state.previewSeq
  if (status) status.textContent = '渲染中…'
  try {
    const doc = await api.preview({ data: state.data, body: state.body, base: state.path, lang: state.lang })
    if (seq !== state.previewSeq) return
    frame.srcdoc = doc
    if (status) status.textContent = '✓ 已更新'
  } catch (e) {
    if (seq !== state.previewSeq) return
    if (status) status.textContent = '✗ 渲染失败'
    frame.srcdoc =
      `<html><body style="font-family:system-ui;padding:24px;color:#dc2626">` +
      escapeHtml((e as Error).message) +
      '</body></html>'
  }
}

function togglePreview() {
  const main = document.querySelector('#editor-main')
  main?.classList.toggle('no-preview')
}

// ---------------- 保存 / 自动保存 / 删除 / 上传 ----------------

// 自动保存：只在「有改动」且「没有保存在进行」时写盘，一分钟后自然重试
async function autoSave(state: EditorState) {
  if (!state.dirty || state.saving) return
  await doSave(state, { auto: true })
}

// 自动保存的提示：顶栏显示最近一次保存时间，不弹 toast（每分钟弹一次太吵）
function showAutosaveHint() {
  const hint = document.querySelector('#autosave-hint') as HTMLElement | null
  if (!hint) return
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  hint.textContent = `已自动保存 ${pad(now.getHours())}:${pad(now.getMinutes())}`
  hint.hidden = false
}

async function doSave(state: EditorState, opts: { auto?: boolean } = {}) {
  if (state.saving) return
  state.saving = true
  const btn = document.querySelector('#btn-save') as HTMLButtonElement | null
  if (btn) btn.disabled = true
  // 先固化本次要写盘的内容：请求期间用户还能继续输入，
  // 快照按「已发出的那一份」算，这些新输入才不会被误标成已保存
  const payload = { data: { ...state.data }, body: state.body }
  const sent = JSON.stringify(payload)
  const before = state.path
  try {
    const res = await api.save(before, state.lang, payload)
    state.path = res.path
    // 更新本语言版本的本地副本：切走再切回来才会读到刚保存的内容
    // （否则读到的是打开页面时的旧内容，再被自动保存写回去）
    state.detail.files[state.lang] = { content: payload.body, data: payload.data }
    state.snapshot = sent
    state.dirty = makeSnapshot(state) !== state.snapshot
    const badge = document.querySelector('#dirty-badge') as HTMLElement | null
    if (badge) badge.hidden = !state.dirty
    if (opts.auto) {
      // 自动保存不重建界面（navigate 会重建编辑器、丢掉光标与撤销栈），
      // 只有真的移动过文件夹时才把地址栏静默对齐到新路径
      if (res.path !== before) history.replaceState(null, '', `#/edit/${encodePath(res.path)}`)
      showAutosaveHint()
      return
    }
    toast('已保存')
    const current = decodeURIComponent(location.hash.replace(/^#\/edit\//, ''))
    if (res.path !== current) {
      navigate(`#/edit/${encodePath(res.path)}`)
    }
  } catch (e) {
    toast((e as Error).message, 'error')
  } finally {
    state.saving = false
    if (btn) btn.disabled = false
  }
}

async function doDelete(state: EditorState) {
  if (!window.confirm(`确定删除文章「${state.data.title || state.path}」？\n将删除整个文件夹及其所有语言版本，不可恢复。`)) {
    return
  }
  try {
    await api.remove(state.path)
    toast('已删除')
    navigate('#/list')
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

// 打开博客中当前文章（新标签页）；博客地址默认 http://localhost:4321，
// 可用 localStorage 键 cms-blog-base 覆盖（例如博客端口不同时）
function blogOrigin(): string {
  try {
    return localStorage.getItem('cms-blog-base') || 'http://localhost:4321'
  } catch {
    return 'http://localhost:4321'
  }
}

function openInBlog(state: EditorState) {
  const url = `${blogOrigin()}/blog/${encodePath(state.path)}`
  window.open(url, '_blank', 'noopener')
}

// 用系统默认的文件管理器打开当前文章所在文件夹（服务端调用 explorer / open / xdg-open）
async function openFolder(state: EditorState) {
  try {
    const res = await api.reveal(state.path)
    toast(`已打开文件夹 ${res.dir}`)
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

function pickFile(state: EditorState) {
  const input = el('input', { type: 'file', accept: 'image/*' })
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const res = await api.upload(file, state.path)
      state.data.image = res.url
      syncForm(state)
      markDirty(state)
      toast(`已上传 ${res.name}，记得保存`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  })
  input.click()
}
