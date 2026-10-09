// ConfigPage.ts — 网站配置（src/config.ts）可视化编辑
//
// 页面按分区渲染表单，保存时把整份配置值提交给 /api/config，
// 服务端只把「真正改动过」的字段写回文件，注释与排版保持不变。
import { api } from '../api'
import type { ConfigDoc, ConfigValues, FriendLinkItem } from '../types'
import { el, escapeHtml } from '../dom'
import { createSelect } from '../select'
import { createConfigToc, type ConfigToc } from './config-toc'
import { pageHeader } from './header'
import { toast } from '../ui'

// ---------------- 表单描述 ----------------

type FieldType = 'text' | 'number' | 'bool' | 'select' | 'tags'

interface FieldDef {
  path: (string | number)[]
  label: string
  // 缺省为单行文本输入
  type?: FieldType
  hint?: string
  options?: string[]
  mono?: boolean
  placeholder?: string
  wide?: boolean
  // 同名的连续字段算一组：「主题与动效」按语义分组，组与组之间画一条浅色横线
  group?: string
}

interface SectionDef {
  id: string
  title: string
  desc?: string
  fields?: FieldDef[]
  kind?: 'friendLinks'
}

interface ConfigState {
  values: ConfigValues
  source: string
  snapshot: string
  dirty: boolean
  saving: boolean
  toc: ConfigToc
}

// 各页面 Cover 文案的字段（与 i18nConfig.translations 结构对应）
const COVER_PAGES = [
  { key: 'home', label: '首页' },
  { key: 'archive', label: '归档页' },
  { key: 'about', label: '关于页' },
  { key: 'friends', label: '友链页' },
]

function buildSections(values: ConfigValues): SectionDef[] {
  const langs: string[] = Array.isArray(values?.i18nConfig?.supportedLanguages)
    ? values.i18nConfig.supportedLanguages
    : []
  const sections: SectionDef[] = [
    {
      id: 'site',
      title: '站点信息',
      desc: '标题、域名与 favicon，改动后需重新构建博客才会生效',
      fields: [
        { path: ['siteConfig', 'title'], label: '站点标题 title', hint: '浏览器标签栏与 SEO 使用' },
        { path: ['siteConfig', 'subTitle'], label: '副标题 subTitle', hint: '留空时标签栏只显示站点标题' },
        { path: ['siteConfig', 'rootSiteUrl'], label: '站点根地址 rootSiteUrl', mono: true, wide: true, hint: '生成 SEO 与分享用的绝对链接' },
        { path: ['siteConfig', 'favicon'], label: 'favicon 路径', mono: true, hint: '相对 /public 目录，如 /favicon/favicon.ico' },
        { path: ['siteConfig', 'pageSize'], label: '每页文章数 pageSize', type: 'number' },
      ],
    },
    {
      id: 'page',
      title: '阅读与目录',
      fields: [
        { path: ['siteConfig', 'toc', 'enable'], label: '目录 toc.enable', type: 'bool' },
        { path: ['siteConfig', 'toc', 'depth'], label: '目录最大层级 toc.depth', type: 'number', hint: '1 - 4' },
        { path: ['siteConfig', 'blogNavi', 'enable'], label: '底部文章导航 blogNavi', type: 'bool' },
      ],
    },
    {
      id: 'comments',
      title: '评论',
      fields: [
        { path: ['siteConfig', 'comments', 'enable'], label: '启用评论', type: 'bool' },
        { path: ['siteConfig', 'comments', 'platform'], label: '评论平台 platform', type: 'select', options: ['default', 'twikoo'] },
        { path: ['siteConfig', 'comments', 'backendUrl'], label: '后端地址 backendUrl', mono: true, wide: true },
      ],
    },
    {
      id: 'theme',
      title: '主题与动效',
      // group：同名连续字段算一组，组与组之间画一条浅色横线
      // （动效基础 / 图片拼图 / 卡片封面 / 首页照片封面 / 悬浮滚动条）
      fields: [
        { path: ['siteConfig', 'theme', 'AOS'], label: '滚动动画 AOS', type: 'bool', group: '动效基础' },
        { path: ['siteConfig', 'theme', 'LQIP'], label: '图片占位 LQIP', type: 'bool', group: '动效基础' },
        { path: ['siteConfig', 'theme', 'PhotoSwipe'], label: '图片查看器 PhotoSwipe', type: 'bool', group: '动效基础' },
        {
          path: ['siteConfig', 'theme', 'imageCollage', 'enable'],
          label: '连续图片自动拼图 imageCollage',
          type: 'bool',
          group: '图片拼图',
          hint: '正文里连续放置的多张图片自动排成网格（不显示图注；每行高度由该行最宽的图片决定并让它完整显示，其余按这个高度裁切）（需重新构建博客）',
        },
        {
          path: ['siteConfig', 'theme', 'imageCollage', 'maxColumns'],
          label: '拼图每行最多几张 maxColumns',
          type: 'number',
          group: '图片拼图',
          hint: '取值 2 - 6，实际每行张数会按图片数量自动选择',
        },
        {
          path: ['siteConfig', 'theme', 'postCard', 'imageMode'],
          label: '卡片封面模式',
          type: 'select',
          options: ['top', 'background'],
          group: '卡片封面',
          hint: 'top：封面在上方；background：封面作为卡片背景',
        },
        {
          path: ['siteConfig', 'theme', 'photoCover', 'enable'],
          label: '首页照片封面 photoCover',
          type: 'bool',
          group: '首页照片封面',
          hint: '首页第 1 页用整屏照片做背景，标题与副标题居中显示；向下滚动时标题平滑落回正常位置、照片淡成底色（需重新构建博客）',
        },
        {
          path: ['siteConfig', 'theme', 'photoCover', 'image'],
          label: '照片路径 photoCover.image',
          mono: true,
          group: '首页照片封面',
          hint: '以 / 开头相对 /public，否则相对 /src（如 assets/cover.jpg）。模糊底图由构建期自动生成，无需自己准备；想换成自己挑的小图，可在 public 下同名目录的 preview/ 里放一张（存在时优先用它）',
        },
        {
          path: ['siteConfig', 'theme', 'photoCover', 'mask'],
          label: '蒙版浓度 photoCover.mask（0 - 1）',
          type: 'number',
          group: '首页照片封面',
          hint: '照片上的黑色蒙版浓度，保证白色标题清晰；随滚动逐渐消退',
        },
        {
          path: ['siteConfig', 'theme', 'overlayScrollbars', 'enable'],
          label: '悬浮滚动条 overlayScrollbars',
          type: 'bool',
          group: '悬浮滚动条',
          hint: '用 OverlayScrollbars 替换浏览器默认的整页滚动条（悬浮样式，可自动隐藏）',
        },
        {
          path: ['siteConfig', 'theme', 'overlayScrollbars', 'autoHide'],
          label: '滚动条自动隐藏 autoHide',
          type: 'select',
          options: ['never', 'scroll', 'move', 'leave'],
          group: '悬浮滚动条',
          hint: 'never：一直显示；scroll：滚动时才显示；move：指针移到页面上或滚动时显示；leave：指针离开页面且不滚动时隐藏',
        },
        {
          path: ['siteConfig', 'theme', 'overlayScrollbars', 'size'],
          label: '滚动条粗细 size（px）',
          type: 'number',
          group: '悬浮滚动条',
        },
      ],
    },
    {
      id: 'code',
      title: '代码块',
      desc: 'Expressive Code（代码高亮与增强），保存后博客需重新构建，CMS 预览会自动跟随',
      fields: [
        {
          path: ['siteConfig', 'expressiveCode', 'enable'],
          label: '启用 Expressive Code',
          type: 'bool',
          hint: '关闭后代码块不再高亮，回退为纯文本代码块',
        },
        {
          path: ['siteConfig', 'expressiveCode', 'theme'],
          label: '代码主题 theme',
          type: 'select',
          options: [
            'one-dark-pro',
            'one-light',
            'github-dark',
            'github-light',
            'vitesse-dark',
            'vitesse-light',
            'dracula',
            'nord',
            'monokai',
            'solarized-dark',
            'solarized-light',
          ],
          hint: 'Shiki 主题名，深浅色模式共用同一套主题',
        },
      ],
    },
    {
      id: 'profile',
      title: '个人信息',
      fields: [
        { path: ['profileConfig', 'avatar'], label: '头像 avatar', mono: true, hint: '相对 /src 目录；以 / 开头则相对 /public' },
        { path: ['profileConfig', 'name'], label: '昵称 name' },
        { path: ['profileConfig', 'description'], label: '简介 description', wide: true },
        { path: ['profileConfig', 'indexPage'], label: '个人主页 indexPage', mono: true, wide: true },
        { path: ['profileConfig', 'startYear'], label: '建站年份 startYear', type: 'number' },
      ],
    },
    {
      id: 'license',
      title: '许可协议',
      fields: [
        { path: ['licenseConfig', 'enable'], label: '启用许可信息', type: 'bool' },
        { path: ['licenseConfig', 'name'], label: '协议名称', wide: true },
        { path: ['licenseConfig', 'url'], label: '协议地址', mono: true, wide: true },
      ],
    },
    {
      id: 'i18n',
      title: '国际化',
      desc: '支持的语种与默认语言，Cover 文案见下方各语言分区',
      fields: [
        { path: ['i18nConfig', 'defaultLanguage'], label: '默认语言 defaultLanguage', type: 'select', options: langs },
        { path: ['i18nConfig', 'supportedLanguages'], label: '支持的语言 supportedLanguages', type: 'tags', wide: true, hint: '用逗号分隔，如 zh-cn, en' },
      ],
    },
    {
      id: 'friends',
      title: '友情链接',
      desc: 'friendLinkConfig：每项包含名称、头像、地址与描述',
      kind: 'friendLinks',
    },
  ]

  // 每种语言的 Cover 文案（首页 / 归档 / 关于 / 友链 的大标题与副标题）
  for (const lang of langs) {
    const fields: FieldDef[] = []
    for (const page of COVER_PAGES) {
      const base = ['i18nConfig', 'translations', lang, 'Cover']
      fields.push({ path: [...base, 'title', page.key], label: `${page.label}标题 ${page.key}.title` })
      fields.push({
        path: [...base, 'subTitle', page.key],
        label: `${page.label}副标题 ${page.key}.subTitle`,
        hint: page.key === 'archive' ? '支持 {count} 占位符' : undefined,
      })
    }
    sections.push({ id: `cover-${lang}`, title: `Cover 文案 · ${lang}`, fields })
  }

  return sections
}

// ---------------- 入口 ----------------

export async function renderConfig(root: HTMLElement) {
  let doc: ConfigDoc
  try {
    doc = await api.getConfig()
  } catch (e) {
    root.append(el('div', { class: 'cms-error' }, [escapeHtml((e as Error).message)]))
    return
  }

  const state: ConfigState = {
    values: doc.values || {},
    source: doc.source || '',
    snapshot: '',
    dirty: false,
    saving: false,
    toc: createConfigToc(),
  }
  state.snapshot = JSON.stringify(state.values)

  const badge = el('span', { class: 'dirty-badge', hidden: true }, ['● 未保存'])
  const main = el('main', { class: 'cms-main cms-config' })

  const saveBtn = el('button', { class: 'btn btn-primary', onclick: () => doSave(state, main, badge) }, [
    '保存配置',
  ])
  const reloadBtn = el('button', { class: 'btn', onclick: () => doReload(state, main, badge) }, ['重新加载'])

  root.append(
    pageHeader('config', el('div', { class: 'editor-actions' }, [badge, reloadBtn, saveBtn])),
    state.toc.el,
    main,
  )
  renderBody(main, state, badge)

  // Ctrl+S 保存 / 离开页面前提醒
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      doSave(state, main, badge)
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
  ;(root as HTMLElement & { __cleanup?: () => void }).__cleanup = () => {
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('beforeunload', onBeforeUnload)
    state.toc.destroy()
  }
}

// ---------------- 渲染 ----------------

function renderBody(main: HTMLElement, state: ConfigState, badge: HTMLElement) {
  const scrollY = window.scrollY
  main.innerHTML = ''
  main.append(
    el('div', { class: 'cfg-intro' }, [
      '配置文件 ',
      el('code', {}, ['src/config.ts']),
      '：修改后点击右上角「保存配置」写回文件（只改写改动过的字段，注释与排版保持不变）。',
    ]),
  )
  const sections = buildSections(state.values)
  for (const section of sections) {
    main.append(renderSection(section, state, main, badge))
  }
  main.append(renderSource(state))
  // 悬浮目录栏跟着分区列表走（保存 / 重新加载 / 改了语种都会重建表单）
  state.toc.setSections(sections.map((s) => ({ id: s.id, title: s.title })))
  window.scrollTo(0, scrollY)
}

function renderSection(
  section: SectionDef,
  state: ConfigState,
  main: HTMLElement,
  badge: HTMLElement,
): HTMLElement {
  const body =
    section.kind === 'friendLinks'
      ? renderFriendLinks(state, main, badge)
      : renderFields(section.fields || [], state, badge)

  return el('section', { class: 'panel cfg-section', id: `cfg-${section.id}` }, [
    el('div', { class: 'cfg-section-head' }, [
      el('h2', { class: 'panel-title' }, [section.title]),
      section.desc ? el('p', { class: 'cfg-desc' }, [section.desc]) : null,
    ]),
    body,
  ])
}

// 字段网格：没有 group 的走原来的两列布局；有 group 的先按同名连续字段切段，
// 每段一个 .cfg-group（内部仍是两列），组与组之间由 CSS 画一条浅色横线
function renderFields(fields: FieldDef[], state: ConfigState, badge: HTMLElement): HTMLElement {
  if (!fields.some((f) => f.group)) {
    return el('div', { class: 'cfg-grid' }, fields.map((f) => renderField(f, state, badge)))
  }

  const runs: { group?: string; fields: FieldDef[] }[] = []
  for (const field of fields) {
    const last = runs[runs.length - 1]
    if (last && last.group === field.group) last.fields.push(field)
    else runs.push({ group: field.group, fields: [field] })
  }

  return el(
    'div',
    { class: 'cfg-groups' },
    runs.map((run) =>
      el(
        'div',
        { class: 'cfg-group' },
        run.fields.map((f) => renderField(f, state, badge)),
      ),
    ),
  )
}

function renderField(field: FieldDef, state: ConfigState, badge: HTMLElement): HTMLElement {
  const value = getByPath(state.values, field.path)
  const set = (v: unknown) => {
    setByPath(state.values, field.path, v)
    markDirty(state, badge)
  }

  // 开关
  if (field.type === 'bool') {
    return el('div', { class: 'cfg-field cfg-field-check' + (field.wide ? ' wide' : '') }, [
      el('label', { class: 'form-check' }, [
        el('input', {
          type: 'checkbox',
          checked: !!value,
          onchange: (e: Event) => set((e.target as HTMLInputElement).checked),
        }),
        el('span', {}, [field.label]),
      ]),
      field.hint ? el('div', { class: 'cfg-hint' }, [field.hint]) : null,
    ])
  }

  let control: HTMLElement
  if (field.type === 'select') {
    const options = [...(field.options || [])]
    if (value !== undefined && value !== null && !options.includes(String(value))) {
      options.push(String(value))
    }
    control = createSelect({
      options: options.map((o) => ({ value: o, label: o })),
      value: String(value ?? ''),
      onChange: (v: string) => set(v),
    })
  } else if (field.type === 'tags') {
    control = el('input', {
      class: 'input mono',
      value: Array.isArray(value) ? value.join(', ') : '',
      placeholder: field.placeholder || 'zh-cn, en',
      oninput: (e: Event) =>
        set(
          (e.target as HTMLInputElement).value
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
    })
  } else if (field.type === 'number') {
    control = el('input', {
      class: 'input',
      type: 'number',
      value: value === undefined || value === null ? '' : String(value),
      oninput: (e: Event) => {
        const raw = (e.target as HTMLInputElement).value
        // 清空时不写回，避免把数字字段变成空字符串
        if (raw === '') return
        set(Number(raw))
      },
    })
  } else {
    control = el('input', {
      class: 'input' + (field.mono ? ' mono' : ''),
      value: value === undefined || value === null ? '' : String(value),
      placeholder: field.placeholder,
      oninput: (e: Event) => set((e.target as HTMLInputElement).value),
    })
  }

  return el('label', { class: 'cfg-field' + (field.wide ? ' wide' : '') }, [
    el('span', { class: 'cfg-label' }, [field.label]),
    control,
    field.hint ? el('div', { class: 'cfg-hint' }, [field.hint]) : null,
  ])
}

// ---------------- 友情链接 ----------------

function renderFriendLinks(state: ConfigState, main: HTMLElement, badge: HTMLElement): HTMLElement {
  if (!Array.isArray(state.values.friendLinkConfig)) state.values.friendLinkConfig = []
  const list: FriendLinkItem[] = state.values.friendLinkConfig

  const rows = list.map((item, index) =>
    el('div', { class: 'cfg-link-row' }, [
      el('div', { class: 'cfg-link-fields' }, [
        linkInput(item, 'name', '名称', state, badge),
        linkInput(item, 'url', '主页地址', state, badge, true),
        linkInput(item, 'avatar', '头像地址', state, badge, true),
        linkInput(item, 'description', '描述', state, badge),
      ]),
      el('div', { class: 'cfg-link-actions' }, [
        el('button', {
          class: 'row-act',
          title: '上移',
          disabled: index === 0,
          onclick: () => moveLink(state, index, -1, main, badge),
        }, ['↑']),
        el('button', {
          class: 'row-act',
          title: '下移',
          disabled: index === list.length - 1,
          onclick: () => moveLink(state, index, 1, main, badge),
        }, ['↓']),
        el('button', {
          class: 'row-act row-act-danger',
          title: '删除',
          onclick: () => removeLink(state, index, main, badge),
        }, ['✕']),
      ]),
    ]),
  )

  return el('div', { class: 'cfg-links' }, [
    list.length ? el('div', { class: 'cfg-links-head' }, [
      el('span', {}, ['名称']),
      el('span', {}, ['主页地址']),
      el('span', {}, ['头像地址']),
      el('span', {}, ['描述']),
      el('span', {}, ['操作']),
    ]) : el('div', { class: 'panel-empty' }, ['暂无友链']),
    ...rows,
    el('button', {
      class: 'btn btn-sm',
      onclick: () => {
        list.push({ name: '', avatar: '', url: '', description: '' })
        markDirty(state, badge)
        renderBody(main, state, badge)
      },
    }, ['＋ 添加友链']),
  ])
}

function linkInput(
  item: FriendLinkItem,
  key: keyof FriendLinkItem,
  placeholder: string,
  state: ConfigState,
  badge: HTMLElement,
  mono = false,
): HTMLElement {
  return el('input', {
    class: 'input' + (mono ? ' mono' : ''),
    value: item[key] ?? '',
    placeholder,
    oninput: (e: Event) => {
      item[key] = (e.target as HTMLInputElement).value
      markDirty(state, badge)
    },
  })
}

function moveLink(state: ConfigState, index: number, delta: number, main: HTMLElement, badge: HTMLElement) {
  const list = state.values.friendLinkConfig as FriendLinkItem[]
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  markDirty(state, badge)
  renderBody(main, state, badge)
}

function removeLink(state: ConfigState, index: number, main: HTMLElement, badge: HTMLElement) {
  const list = state.values.friendLinkConfig as FriendLinkItem[]
  if (!window.confirm(`确定删除友链「${list[index]?.name || index + 1}」？`)) return
  list.splice(index, 1)
  markDirty(state, badge)
  renderBody(main, state, badge)
}

// ---------------- 源码预览 ----------------

function renderSource(state: ConfigState): HTMLElement {
  const pre = el('pre', { class: 'cfg-source mono' }, [state.source])
  const panel = el('section', { class: 'panel cfg-section cfg-source-panel collapsed' }, [
    el('button', { class: 'form-toggle', onclick: () => panel.classList.toggle('collapsed') }, [
      el('span', { class: 'form-toggle-icon' }, ['<>']),
      el('span', { class: 'form-toggle-text' }, ['查看文件源码（只读）']),
      el('span', { class: 'form-toggle-arrow' }, ['▾']),
    ]),
    pre,
  ])
  return panel
}

// ---------------- 状态与保存 ----------------

function markDirty(state: ConfigState, badge: HTMLElement) {
  state.dirty = JSON.stringify(state.values) !== state.snapshot
  badge.hidden = !state.dirty
}

async function doSave(state: ConfigState, main: HTMLElement, badge: HTMLElement) {
  if (state.saving) return
  state.saving = true
  try {
    const res = await api.saveConfig(state.values)
    state.values = res.values || state.values
    state.source = res.source || state.source
    state.snapshot = JSON.stringify(state.values)
    state.dirty = false
    badge.hidden = true
    renderBody(main, state, badge)
    toast(res.changed === false ? '没有需要保存的改动' : '配置已保存到 src/config.ts')
  } catch (e) {
    toast((e as Error).message, 'error')
  } finally {
    state.saving = false
  }
}

async function doReload(state: ConfigState, main: HTMLElement, badge: HTMLElement) {
  if (state.dirty && !window.confirm('有未保存的改动，重新加载将丢弃这些改动，继续？')) return
  try {
    const doc = await api.getConfig()
    state.values = doc.values || {}
    state.source = doc.source || ''
    state.snapshot = JSON.stringify(state.values)
    state.dirty = false
    badge.hidden = true
    renderBody(main, state, badge)
    toast('已重新加载')
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

// ---------------- 路径读写 ----------------

function getByPath(obj: ConfigValues, path: (string | number)[]): unknown {
  let cur: any = obj
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined
    cur = cur[key as never]
  }
  return cur
}

function setByPath(obj: ConfigValues, path: (string | number)[], value: unknown) {
  let cur: any = obj
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const next = path[i + 1]
    if (cur[key as never] === null || typeof cur[key as never] !== 'object') {
      cur[key as never] = typeof next === 'number' ? [] : {}
    }
    cur = cur[key as never]
  }
  cur[path[path.length - 1] as never] = value
}
