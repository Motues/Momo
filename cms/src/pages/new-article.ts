import { api } from '../api'
import { navigate } from '../router'
import { el, encodePath } from '../dom'
import { createSelect, createComboSelect } from '../select'
import { toast } from '../ui'

// 新建文章弹窗（列表页 / 概览页共用）
// 标题 / 路径 / 语言 / 分类一次填完就写进 frontmatter，创建后直接进编辑器。
export function openNewModal(root: HTMLElement, categories: string[]) {
  const titleInput = el('input', {
    class: 'input',
    id: 'new-title',
    placeholder: '文章标题（必填）',
    maxlength: 120,
  }) as HTMLInputElement

  const pathInput = el('input', {
    class: 'input',
    id: 'new-path',
    placeholder: '如 my-post 或 category/my-post',
  }) as HTMLInputElement

  const generatedHint = el('small', { class: 'modal-hint' }, [
    '留空将按日期自动生成路径，如 ',
    el('code', {}, [autoPath()]),
  ])

  const langSelect = createSelect({
    id: 'new-lang',
    options: [
      { value: 'zh-cn', label: 'zh-cn' },
      { value: 'en', label: 'en' },
    ],
  })

  // 分类：自研可输入下拉——点箭头选已有分类，也可以直接输入新分类
  const categorySelect = createComboSelect({
    id: 'new-category',
    placeholder: '选择或输入分类（可选）',
    options: categories.map((c) => ({ value: c, label: c })),
  })

  const submitBtn = el('button', {
    class: 'btn btn-primary',
    id: 'modal-submit',
    type: 'button',
    onclick: () => void submit(),
  }, ['创建'])

  const overlay = el('div', { class: 'modal-overlay' }, [
    el('div', {
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'new-modal-title',
    }, [
      el('h2', { class: 'modal-title', id: 'new-modal-title' }, ['新建文章']),
      el('label', { class: 'modal-field' }, ['标题', titleInput]),
      el('label', { class: 'modal-field' }, ['路径（slugId，可含多级目录）', pathInput, generatedHint]),
      el('label', { class: 'modal-field' }, ['语言', langSelect]),
      el('label', { class: 'modal-field' }, [
        '分类',
        categorySelect,
        el('small', { class: 'modal-hint' }, ['点右侧箭头选已有分类，也可以直接输入新分类']),
      ]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: close }, ['取消']),
        submitBtn,
      ]),
    ]),
  ])

  let closed = false
  let busy = false

  function close() {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeyDown)
    categorySelect.closePanel()
    overlay.remove()
    // 焦点还给打开弹窗的按钮
    document.getElementById('btn-new')?.focus({ preventScroll: true })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!overlay.isConnected) {
      // 弹窗已被换页清掉：顺手摘掉全局监听，避免残留
      document.removeEventListener('keydown', onKeyDown)
      return
    }
    if (e.key !== 'Escape') return
    // 分类下拉展开时 Esc 已由下拉自己消费（select.ts 里 stopPropagation），不会走到这里
    e.preventDefault()
    close()
  }

  async function submit() {
    if (busy || closed) return
    const title = titleInput.value.trim()
    if (!title) {
      toast('请填写文章标题', 'error')
      titleInput.focus()
      return
    }
    const path = pathInput.value.trim() || autoPath()
    const lang = langSelect.value
    const category = categorySelect.value.trim()
    busy = true
    submitBtn.disabled = true
    try {
      const res = await api.create({ path, lang, title, category })
      close()
      toast(`已创建 ${res.path}`)
      navigate(`#/edit/${encodePath(res.path)}`)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      busy = false
      submitBtn.disabled = false
    }
  }

  // 点遮罩关闭：只在「按下与抬起都在遮罩上」时才关，避免从弹窗里拖选文字拖出去误关
  let pressedOnOverlay = false
  overlay.addEventListener('pointerdown', (e) => {
    pressedOnOverlay = e.target === overlay
  })
  overlay.addEventListener('click', (e) => {
    if (pressedOnOverlay && e.target === overlay) close()
  })

  // 标题 / 路径里回车直接创建（输入法候选词确认时的回车不算）
  const onEnter = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.isComposing) return
    e.preventDefault()
    void submit()
  }
  titleInput.addEventListener('keydown', onEnter)
  pathInput.addEventListener('keydown', onEnter)

  document.addEventListener('keydown', onKeyDown)
  root.append(overlay)
  titleInput.focus()
}

// 生成 yyyy/yyyy-mm-dd 路径
export function autoPath(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}/${y}-${m}-${d}`
}
