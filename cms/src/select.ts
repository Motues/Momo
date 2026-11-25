// 自研下拉选择组件（替换原生 <select>）
//
// 用法：createSelect({ id, class?, title?, options, value?, onChange, search? }) 返回触发器本身，
//       .value 读写当前值，.setOptions(options, value?) 重建选项。
//
// ⚠️ 面板挂在 body 上、position: fixed 定位（否则会被层叠上下文 / overflow 裁掉或压住）。
// 不开搜索框时焦点留在触发器上、键盘交互都挂在触发器上；开 search 后打开面板焦点进入
// 顶部搜索框，方向键 / Enter / Esc 由输入框接管。Esc 额外用 document 捕获监听兜底。
import { el } from './dom'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectConfig {
  id?: string
  /** 追加在触发器上的额外类（.input / .cms-select-trigger 始终会加） */
  class?: string
  title?: string
  value?: string
  options?: SelectOption[]
  /** 值变化时回调（同值不触发） */
  onChange?: (value: string) => void
  /** 面板顶部显示搜索框，按 label / value 实时过滤（选项很多时用） */
  search?: boolean
  /** 搜索框占位文案（默认「搜索…」） */
  searchPlaceholder?: string
}

export interface SelectControl extends HTMLButtonElement {
  setOptions(options: SelectOption[], value?: string): void
}

// 同一时刻只允许一个面板展开（点开 B 时 A 必须收起，也顺带收掉上个页面遗留的面板）
let openCloser: (() => void) | null = null
let uid = 0

// 面板定位（createSelect / createComboSelect 共用）：默认贴着锚点下方，
// 下面放不下且上面更宽裕时向上翻转；超出可用高度时面板内部滚动。
function placePanel(panel: HTMLElement, rect: DOMRect) {
  const gap = 6
  const edge = 8
  panel.style.maxHeight = ''
  panel.style.minWidth = `${Math.round(rect.width)}px`
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const below = window.innerHeight - rect.bottom - gap - edge
  const above = rect.top - gap - edge
  const up = height > below && above > below
  panel.style.maxHeight = `${Math.round(Math.min(320, Math.max(140, up ? above : below)))}px`
  panel.style.left = `${Math.round(Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge)))}px`
  if (up) {
    panel.classList.add('is-drop-up')
    panel.style.top = 'auto'
    panel.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`
  } else {
    panel.classList.remove('is-drop-up')
    panel.style.top = `${Math.round(rect.bottom + gap)}px`
    panel.style.bottom = 'auto'
  }
}

export function createSelect(config: SelectConfig = {}): SelectControl {
  const panelId = `cms-select-${++uid}`
  const listId = `${panelId}-list`
  let options: SelectOption[] = [...(config.options || [])]
  /** 搜索过滤后真正展示 / 可键盘选中的选项 */
  let visibleOptions: SelectOption[] = options
  let value = config.value ?? ''
  let activeIndex = 0
  let open = false
  let query = ''
  // 首字母跳转的前缀缓冲：600ms 内的连续按键合并成前缀（不开搜索框时用）
  let typeBuffer = ''
  let typeTimer = 0

  const valueEl = el('span', { class: 'cms-select-value' })
  const arrowEl = el('span', { class: 'cms-select-arrow' })
  const trigger = el(
    'button',
    {
      type: 'button',
      class: `input cms-select-trigger${config.class ? ` ${config.class}` : ''}`,
      id: config.id,
      title: config.title,
      role: 'combobox',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      'aria-controls': listId,
    },
    [valueEl, arrowEl],
  ) as SelectControl

  const panel = el('div', {
    class: 'cms-select-panel',
    id: panelId,
    hidden: true,
  })
  const listEl = el('div', { class: 'cms-select-list', id: listId, role: 'listbox' })
  const searchInput = config.search
    ? (el('input', {
        type: 'search',
        class: 'cms-select-search',
        placeholder: config.searchPlaceholder || '搜索…',
        autocomplete: 'off',
        spellcheck: false,
        'aria-label': config.searchPlaceholder || '搜索选项',
        'aria-controls': listId,
      }) as HTMLInputElement)
    : null
  panel.append(...(searchInput ? [searchInput] : []), listEl)
  // 带搜索框时面板本身不滚，只让选项列表在面板剩余高度里滚（搜索框固定在顶部）
  if (searchInput) panel.classList.add('has-search')
  // 面板内按下鼠标时不要把焦点从搜索框 / 触发器上抢走；搜索框本身要能正常聚焦
  panel.addEventListener('mousedown', (e) => {
    if (searchInput && (e.target === searchInput || searchInput.contains(e.target as Node))) return
    e.preventDefault()
  })

  // .value 习惯用法照旧可用（编辑器工具栏等直接读 sel.value）
  Object.defineProperty(trigger, 'value', {
    configurable: true,
    get: () => value,
    set: (next: string) => {
      value = String(next)
      syncLabel()
      syncRows()
    },
  })

  function syncLabel() {
    const current = options.find((o) => o.value === value)
    valueEl.textContent = current ? current.label : ''
  }

  // 当前值不在选项里时退回第一项（原生 select 的行为），避免出现空白标签
  function normalizeValue() {
    if (!options.some((o) => o.value === value)) value = options[0]?.value ?? ''
    activeIndex = Math.max(0, options.findIndex((o) => o.value === value))
  }

  /** 按搜索词过滤：label 与 value 都参与匹配 */
  function applyFilter() {
    const needle = query.trim().toLowerCase()
    visibleOptions = needle
      ? options.filter(
          (o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle),
        )
      : options.slice()
  }

  function syncRows() {
    listEl.textContent = ''
    if (!visibleOptions.length) {
      listEl.append(
        el('div', { class: 'cms-select-empty' }, [query.trim() ? '没有匹配的选项' : '暂无可选项']),
      )
      activeIndex = -1
      return
    }
    visibleOptions.forEach((opt, i) => {
      const selected = opt.value === value
      listEl.append(
        el(
          'div',
          {
            class: `cms-select-option${selected ? ' is-selected' : ''}`,
            id: `${panelId}-opt-${i}`,
            role: 'option',
            'aria-selected': selected ? 'true' : 'false',
            onclick: () => pick(opt.value),
            onmousemove: () => setActive(i, false),
          },
          [opt.label],
        ),
      )
    })
    activeIndex = Math.max(0, Math.min(activeIndex, visibleOptions.length - 1))
    setActive(activeIndex, false)
  }

  // 高亮某一项（不动值）；列表自己滚，不用 scrollIntoView——那会连页面一起滚
  function setActive(index: number, scroll = true) {
    if (!visibleOptions.length) return
    activeIndex = (index + visibleOptions.length) % visibleOptions.length
    const rows = listEl.children
    for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('is-active', i === activeIndex)
    const row = rows[activeIndex] as HTMLElement | undefined
    if (!row) return
    // 面板收起时（初始化 / setOptions）不必写 aria-activedescendant
    if (open) (searchInput ?? trigger).setAttribute('aria-activedescendant', row.id)
    if (!scroll) return
    // 搜索模式下由内层列表滚动，普通下拉仍是面板自己滚
    const scroller = searchInput ? listEl : panel
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top < scroller.scrollTop) scroller.scrollTop = top - 4
    else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight + 4
    }
  }

  function pick(next: string) {
    const changed = next !== value
    value = next
    syncLabel()
    syncRows()
    close()
    // 选完焦点回到触发器，键盘可以继续操作
    trigger.focus({ preventScroll: true })
    if (changed) config.onChange?.(value)
  }

  function place() {
    placePanel(panel, trigger.getBoundingClientRect())
  }

  function onDocPointerDown(e: PointerEvent) {
    const target = e.target as Node
    if (panel.contains(target) || trigger.contains(target)) return
    // 触发器外面的 <label> 被点击时浏览器会把 click 转发给触发器（等于点按钮本身）
    const label = trigger.closest('label')
    if (label && label.contains(target)) return
    close()
  }

  function onScroll(e: Event) {
    // 面板自己的滚动（选项很多时）不算「页面滚了」，不能因此收起
    const target = e.target as Node | null
    if (target && (target === panel || panel.contains(target))) return
    close()
  }

  // Esc 兜底：焦点万一不在搜索框 / 触发器上（脚本点击、焦点被别的东西拿走）也要能收起
  function onDocKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close()
  }

  function openPanel() {
    if (open || !trigger.isConnected) return
    openCloser?.() // 关掉别的实例（含上个页面遗留的面板）
    document.body.append(panel)
    panel.hidden = false
    open = true
    openCloser = close
    trigger.classList.add('is-open')
    trigger.setAttribute('aria-expanded', 'true')
    // 每次打开都从完整列表开始，避免上次的搜索词把当前值过滤掉
    query = ''
    if (searchInput) searchInput.value = ''
    applyFilter()
    syncRows()
    // 先定位（此时才量得到最终高度），再把当前值滚进可视区
    place()
    setActive(Math.max(0, visibleOptions.findIndex((o) => o.value === value)))
    // 开搜索框时焦点直接进输入框，打开即可输入过滤；否则保持原来的「焦点留在触发器」
    if (searchInput) searchInput.focus({ preventScroll: true })
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onDocKeyDown, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('hashchange', close)
  }

  function close() {
    if (!open) return
    open = false
    if (openCloser === close) openCloser = null
    // 搜索框在面板里：先记住焦点是否在里面，移除面板后把焦点还给触发器
    const focusInPanel = panel.contains(document.activeElement)
    trigger.classList.remove('is-open')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.removeAttribute('aria-activedescendant')
    searchInput?.removeAttribute('aria-activedescendant')
    panel.hidden = true
    panel.remove()
    if (focusInPanel) trigger.focus({ preventScroll: true })
    clearTimeout(typeTimer)
    typeBuffer = ''
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onDocKeyDown, true)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('hashchange', close)
  }

  // 首字母跳转：从当前高亮项往后找第一个以该前缀开头的选项
  function typeahead(char: string) {
    const now = Date.now()
    typeBuffer = now - typeTimer > 600 ? char : typeBuffer + char
    typeTimer = now
    const needle = typeBuffer.toLowerCase()
    for (let i = 0; i < visibleOptions.length; i++) {
      const index = (activeIndex + i) % visibleOptions.length
      if (visibleOptions[index].label.toLowerCase().startsWith(needle)) {
        setActive(index)
        return
      }
    }
  }

  trigger.addEventListener('click', () => {
    if (open) close()
    else openPanel()
  })

  // ⚠️ 不要用 trigger 的 blur 收起面板：触屏上点选项会让按钮先失焦，选项就永远选不上。
  // 收起只认这些信号：点面板外（pointerdown）/ 页面滚动 / 换路由 / Esc / 再开一个下拉。

  trigger.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) {
          openPanel()
          return
        }
        // 开了搜索框时焦点已经移进输入框，方向键由它处理
        if (searchInput) return
        setActive(activeIndex + (e.key === 'ArrowDown' ? 1 : -1))
        return
      }
      case 'Home':
        if (open && !searchInput) {
          e.preventDefault()
          setActive(0)
        }
        return
      case 'End':
        if (open && !searchInput) {
          e.preventDefault()
          setActive(visibleOptions.length - 1)
        }
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!open) openPanel()
        else if (visibleOptions.length) pick(visibleOptions[activeIndex]?.value ?? value)
        return
      case 'Escape':
        if (open) {
          // 别让 Esc 继续冒泡给页面上别的快捷键处理
          e.preventDefault()
          e.stopPropagation()
          close()
        }
        return
      case 'Tab':
        close()
        return
      default:
        if (open && e.key.length === 1) typeahead(e.key)
    }
  })

  // 搜索框：输入即过滤，键盘操作与普通下拉一致（↑↓ / Home / End / Enter / Esc / Tab）
  searchInput?.addEventListener('input', () => {
    query = searchInput.value
    applyFilter()
    activeIndex = 0
    syncRows()
    place()
  })

  searchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        setActive(activeIndex + (e.key === 'ArrowDown' ? 1 : -1))
        return
      }
      case 'Home':
        e.preventDefault()
        setActive(0)
        return
      case 'End':
        e.preventDefault()
        setActive(visibleOptions.length - 1)
        return
      case 'Enter':
        e.preventDefault()
        if (visibleOptions.length) pick(visibleOptions[activeIndex]?.value ?? value)
        return
      case 'Escape':
        // 面板打开时 Esc 只收面板，别让弹窗跟着关掉
        e.preventDefault()
        e.stopPropagation()
        close()
        trigger.focus({ preventScroll: true })
        return
      case 'Tab':
        // 面板挂在 body 末尾，不接管焦点的话 Tab 会跑出弹窗；先关面板再把焦点还给触发器
        close()
        trigger.focus({ preventScroll: true })
        return
    }
  })

  trigger.setOptions = (next: SelectOption[], nextValue?: string) => {
    options = next.map((o) => ({ ...o }))
    if (nextValue !== undefined) value = nextValue
    normalizeValue()
    syncLabel()
    applyFilter()
    syncRows()
    if (open) place()
  }

  normalizeValue()
  applyFilter()
  syncLabel()
  syncRows()
  return trigger
}

// ---------------- 可输入下拉（分类这类「选已有，也能自己写」的字段） ----------------
//
// 与 createSelect 的区别：触发器本身是一个 <input>，直接输入即可采用任意值（自定义分类），
// 右侧箭头展开已有选项；输入时按内容过滤，没有完全匹配的选项时在面板顶部提供
// 「使用「xxx」」一行，回车 / 点击即采用。
//
// 返回外层容器（.input.cms-combo）：.value 读写输入框文本，.input 拿真正的输入框。

export interface ComboSelectConfig {
  id?: string
  /** 追加在外层容器上的额外类 */
  class?: string
  title?: string
  placeholder?: string
  value?: string
  options?: SelectOption[]
  /** 采用某个值（点选项 / 回车 / 失焦提交）时回调；同值不触发 */
  onChange?: (value: string) => void
}

export interface ComboSelectControl extends HTMLDivElement {
  /** 真正的输入框（需要聚焦 / 读写光标时用） */
  readonly input: HTMLInputElement
  value: string
  setOptions(options: SelectOption[], value?: string): void
  /** 收起面板（关弹窗 / 换页时调用，避免面板留在 body 上） */
  closePanel(): void
}

interface ComboRow {
  value: string
  label: string
  /** 「使用当前输入」那一行 */
  create?: boolean
}

export function createComboSelect(config: ComboSelectConfig = {}): ComboSelectControl {
  const panelId = `cms-combo-${++uid}`
  let options: SelectOption[] = [...(config.options || [])]
  let open = false
  let rows: ComboRow[] = []
  let activeIndex = 0
  // 最近一次「已采用」的值，用来判断失焦 / 回车时要不要触发 onChange
  let committed = config.value ?? ''

  const input = el('input', {
    type: 'text',
    class: 'cms-combo-input',
    id: config.id,
    placeholder: config.placeholder,
    value: config.value ?? '',
    autocomplete: 'off',
    spellcheck: false,
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': panelId,
  }) as HTMLInputElement

  // 箭头按钮不抢输入框焦点，否则点一下面板就跟着失焦收起了
  const toggle = el('button', {
    type: 'button',
    class: 'cms-combo-toggle',
    'aria-label': '展开选项',
    tabindex: '-1',
    title: '展开选项',
    onmousedown: (e: Event) => e.preventDefault(),
  }, [el('span', { class: 'cms-select-arrow' })])

  const wrapper = el('div', {
    class: `input cms-combo${config.class ? ` ${config.class}` : ''}`,
    title: config.title,
  }, [input, toggle]) as ComboSelectControl

  const panel = el('div', {
    class: 'cms-select-panel',
    id: panelId,
    role: 'listbox',
    hidden: true,
  })
  // 面板内按下鼠标时不要把焦点从输入框上抢走
  panel.addEventListener('mousedown', (e) => e.preventDefault())

  Object.defineProperty(wrapper, 'input', { value: input })
  Object.defineProperty(wrapper, 'value', {
    configurable: true,
    get: () => input.value,
    set: (next: string) => {
      input.value = String(next)
      committed = input.value
      if (open) renderRows()
    },
  })

  function buildRows(): ComboRow[] {
    const query = input.value.trim()
    const needle = query.toLowerCase()
    const matched = options.filter(
      (o) => !needle || o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle),
    )
    const list: ComboRow[] = matched.map((o) => ({ value: o.value, label: o.label }))
    if (query && !options.some((o) => o.value.toLowerCase() === needle)) {
      list.unshift({ value: query, label: `使用「${query}」`, create: true })
    }
    return list
  }

  function renderRows() {
    rows = buildRows()
    panel.textContent = ''
    if (!rows.length) {
      panel.append(el('div', { class: 'cms-select-empty' }, ['暂无可选项，直接输入即可']))
      activeIndex = -1
      return
    }
    const current = input.value.trim()
    rows.forEach((row, i) => {
      const selected = !row.create && row.value === current
      panel.append(
        el(
          'div',
          {
            class: `cms-select-option${row.create ? ' is-create' : ''}${selected ? ' is-selected' : ''}`,
            id: `${panelId}-opt-${i}`,
            role: 'option',
            'aria-selected': selected ? 'true' : 'false',
            onclick: () => pick(row.value),
            onmousemove: () => setActive(i, false),
          },
          [row.label],
        ),
      )
    })
    activeIndex = Math.max(0, Math.min(activeIndex, rows.length - 1))
    setActive(activeIndex, false)
  }

  // 高亮某一项（不动值）；面板自己滚，不用 scrollIntoView——那会连页面一起滚
  function setActive(index: number, scroll = true) {
    if (!rows.length) return
    activeIndex = (index + rows.length) % rows.length
    const children = panel.children
    for (let i = 0; i < children.length; i++) children[i].classList.toggle('is-active', i === activeIndex)
    const row = children[activeIndex] as HTMLElement | undefined
    if (!row) return
    input.setAttribute('aria-activedescendant', row.id)
    if (!scroll) return
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top < panel.scrollTop) panel.scrollTop = top - 4
    else if (bottom > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = bottom - panel.clientHeight + 4
    }
  }

  // 采用一个值：写回输入框、收起面板、通知外部
  function pick(next: string) {
    input.value = next
    renderRows()
    close()
    input.focus({ preventScroll: true })
    commit()
  }

  function commit() {
    if (input.value === committed) return
    committed = input.value
    config.onChange?.(committed)
  }

  function place() {
    placePanel(panel, wrapper.getBoundingClientRect())
  }

  function onDocPointerDown(e: PointerEvent) {
    const target = e.target as Node
    if (panel.contains(target) || wrapper.contains(target)) return
    close()
    commit()
  }

  function onScroll(e: Event) {
    // 面板自己的滚动（选项很多时）不算「页面滚了」，不能因此收起
    const target = e.target as Node | null
    if (target && (target === panel || panel.contains(target))) return
    close()
  }

  // Esc 兜底：焦点万一不在输入框上也要能收起；已收起时把 Esc 让给弹窗
  function onDocKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close()
    commit()
  }

  function openPanel() {
    if (open || !wrapper.isConnected) return
    openCloser?.() // 关掉别的实例（含上个页面遗留的面板）
    document.body.append(panel)
    panel.hidden = false
    open = true
    openCloser = close
    wrapper.classList.add('is-open')
    input.setAttribute('aria-expanded', 'true')
    renderRows()
    place()
    setActive(Math.max(0, rows.findIndex((r) => !r.create && r.value === input.value.trim())), true)
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onDocKeyDown, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('hashchange', close)
  }

  function close() {
    if (!open) return
    open = false
    if (openCloser === close) openCloser = null
    wrapper.classList.remove('is-open')
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
    panel.hidden = true
    panel.remove()
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onDocKeyDown, true)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('hashchange', close)
  }

  toggle.addEventListener('click', () => {
    if (open) close()
    else {
      input.focus({ preventScroll: true })
      openPanel()
    }
  })

  // 点输入框本身不自动展开面板（正常写新分类时不该被列表挡住），只有输入 / 点箭头才展开
  input.addEventListener('input', () => {
    if (!open) openPanel()
    else {
      renderRows()
      place()
    }
  })

  // 失焦即采用当前输入：点面板里的选项时 mousedown 已 preventDefault，不会走到这里
  input.addEventListener('blur', () => {
    close()
    commit()
  })

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) openPanel()
        else setActive(activeIndex + (e.key === 'ArrowDown' ? 1 : -1))
        return
      }
      case 'Home':
        if (open) {
          e.preventDefault()
          setActive(0)
        }
        return
      case 'End':
        if (open) {
          e.preventDefault()
          setActive(rows.length - 1)
        }
        return
      case 'Enter':
        if (open) {
          e.preventDefault()
          const row = rows[activeIndex]
          if (row) pick(row.value)
          else close()
        }
        return
      case 'Escape':
        if (open) {
          // 面板打开时 Esc 只收面板，别让弹窗跟着关掉
          e.preventDefault()
          e.stopPropagation()
          close()
        }
        return
      case 'Tab':
        close()
        commit()
        return
    }
  })

  wrapper.setOptions = (next: SelectOption[], nextValue?: string) => {
    options = next.map((o) => ({ ...o }))
    if (nextValue !== undefined) {
      input.value = nextValue
      committed = nextValue
    }
    if (open) {
      renderRows()
      place()
    }
  }

  wrapper.closePanel = close

  return wrapper
}
