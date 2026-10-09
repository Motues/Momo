// 自研下拉选择组件（替换原生 <select>，外观与交互完全自己控制）
//
// 用法：
//   const sel = createSelect({
//     id: 'sort-by',
//     class: 'tool-select',                        // 追加在触发器上的额外类
//     title: '排序方式',
//     options: [{ value: 'a', label: 'A' }],
//     value: 'a',
//     onChange: (v) => { ... },                    // 值真的变化时才触发（与原生 select 一致）
//   })
//   root.append(sel)                               // 返回的触发器就是控件本身
//   sel.value                                      // 读取当前值
//   sel.setOptions(options, value?)                // 重建选项（分类筛选会用到）
//
// 两个实现要点：
// 1. **面板挂在 body 上、用 position: fixed 定位**：编辑器工具栏 / 弹窗 / 配置网格
//    各有自己的层叠上下文与 overflow，面板留在原地会被裁掉或压住；挂 body 后只需
//    在打开时按触发器的 rect 算一次位置，靠近视口底部时自动向上翻转。
// 2. **焦点始终留在触发器上**（面板内 mousedown 阻止默认行为），因此键盘操作
//    （↑↓ / Home / End / Enter / 首字母跳转）只需要挂在触发器上，不用全局监听；
//    只有 Esc 额外挂了一个 document 捕获监听兜底（脚本点击、焦点被别的东西拿走时也能收）。
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
}

export interface SelectControl extends HTMLButtonElement {
  setOptions(options: SelectOption[], value?: string): void
}

// 同一时刻只允许一个面板展开：点开 B 时 A 必须收起（也顺带收掉上一个页面遗留的面板）
let openCloser: (() => void) | null = null
let uid = 0

export function createSelect(config: SelectConfig = {}): SelectControl {
  const panelId = `cms-select-${++uid}`
  let options: SelectOption[] = [...(config.options || [])]
  let value = config.value ?? ''
  let activeIndex = 0
  let open = false
  // 首字母跳转的前缀缓冲：600ms 内的连续按键合并成前缀
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
      'aria-controls': panelId,
    },
    [valueEl, arrowEl],
  ) as SelectControl

  const panel = el('div', {
    class: 'cms-select-panel',
    id: panelId,
    role: 'listbox',
    hidden: true,
  })
  // 面板内按下鼠标时不要把焦点从触发器上抢走（键盘操作依赖触发器保持聚焦）
  panel.addEventListener('mousedown', (e) => e.preventDefault())

  // 原生 select 的 .value 习惯用法照旧可用（编辑器工具栏等直接读 sel.value）
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

  // 当前值不在选项里时退回第一项（原生 select 就是这么处理的）：
  // 配置项缺失 / 传了空串时不会出现一个空白标签
  function normalizeValue() {
    if (!options.some((o) => o.value === value)) value = options[0]?.value ?? ''
    activeIndex = Math.max(0, options.findIndex((o) => o.value === value))
  }

  function syncRows() {
    panel.textContent = ''
    if (!options.length) {
      panel.append(el('div', { class: 'cms-select-empty' }, ['暂无可选项']))
      return
    }
    options.forEach((opt, i) => {
      const selected = opt.value === value
      panel.append(
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
  }

  // 高亮某一项（不动值）；rows 自己滚，不用 scrollIntoView——那会连页面一起滚
  function setActive(index: number, scroll = true) {
    if (!options.length) return
    activeIndex = (index + options.length) % options.length
    const rows = panel.children
    for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('is-active', i === activeIndex)
    const row = rows[activeIndex] as HTMLElement | undefined
    if (!row) return
    trigger.setAttribute('aria-activedescendant', row.id)
    if (!scroll) return
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top < panel.scrollTop) panel.scrollTop = top - 4
    else if (bottom > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = bottom - panel.clientHeight + 4
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

  // 位置：默认贴着触发器下方；下面放不下且上面更宽裕时向上翻转
  function place() {
    const rect = trigger.getBoundingClientRect()
    const gap = 6
    const edge = 8
    panel.style.maxHeight = ''
    panel.style.minWidth = `${Math.round(rect.width)}px`
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    const below = window.innerHeight - rect.bottom - gap - edge
    const above = rect.top - gap - edge
    const up = height > below && above > below
    // 超出可用空间时让面板自己滚，而不是把面板顶到视口外
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

  // Esc 兜底：焦点万一不在触发器上（脚本点击、焦点被别的东西拿走）也要能收起
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
    syncRows()
    // 先定位（此时才量得到最终高度），再把当前值滚进可视区——选项多时
    // 打开面板应该直接看到选中的那一项，而不是列表顶部
    place()
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
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
    trigger.classList.remove('is-open')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.removeAttribute('aria-activedescendant')
    panel.hidden = true
    panel.remove()
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
    for (let i = 0; i < options.length; i++) {
      const index = (activeIndex + i) % options.length
      if (options[index].label.toLowerCase().startsWith(needle)) {
        setActive(index)
        return
      }
    }
  }

  trigger.addEventListener('click', () => {
    if (open) close()
    else openPanel()
  })

  // 注意：这里**不要**用 trigger 的 blur 来收起面板——触屏上点选项会让按钮先失焦，
  // 面板会在 click 到达之前被移除，选项就永远选不上。收起只认下面这些明确信号：
  // 点面板外（pointerdown）/ 页面滚动 / 换路由 / Esc / 再开一个下拉。

  trigger.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) openPanel()
        setActive(activeIndex + (e.key === 'ArrowDown' ? 1 : -1))
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
          setActive(options.length - 1)
        }
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) pick(options[activeIndex]?.value ?? value)
        else openPanel()
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

  trigger.setOptions = (next: SelectOption[], nextValue?: string) => {
    options = next.map((o) => ({ ...o }))
    if (nextValue !== undefined) value = nextValue
    normalizeValue()
    syncLabel()
    syncRows()
    if (open) place()
  }

  normalizeValue()
  syncLabel()
  syncRows()
  return trigger
}
