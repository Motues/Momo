import { api } from '../api'
import { navigate } from '../router'
import { el, encodePath } from '../dom'
import { createSelect } from '../select'
import { toast } from '../ui'

// 新建文章弹窗（列表页 / 概览页共用）
export function openNewModal(root: HTMLElement, categories: string[]) {
  const langSelect = createSelect({
    options: [
      { value: 'zh-cn', label: 'zh-cn' },
      { value: 'en', label: 'en' },
    ],
  })
  const catList = el('datalist', { id: 'cms-cat-list' })
  for (const c of categories) catList.append(el('option', { value: c }))
  const catInput = el('input', { class: 'input', placeholder: '分类（可选）', list: 'cms-cat-list' })
  const pathInput = el('input', {
    class: 'input',
    placeholder: '如 my-post 或 category/my-post',
  })
  const generatedHint = el('small', { class: 'modal-hint' }, [
    '留空将按日期自动生成路径，如 ',
    el('code', {}, [autoPath()]),
  ])

  const overlay = el('div', { class: 'modal-overlay' }, [
    el('div', { class: 'modal' }, [
      el('h2', { class: 'modal-title' }, ['新建文章']),
      el('label', { class: 'modal-field' }, ['路径（slugId，可含多级目录）', pathInput, generatedHint]),
      el('label', { class: 'modal-field' }, ['语言', langSelect]),
      el('label', { class: 'modal-field' }, ['分类', catInput, catList]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', onclick: () => overlay.remove() }, ['取消']),
        el('button', { class: 'btn btn-primary', id: 'modal-submit', onclick: submit }, ['创建']),
      ]),
    ]),
  ])
  root.append(overlay)
  pathInput.focus()

  async function submit() {
    // 路径留空时自动生成 yyyy/yyyy-mm-dd（按年份分目录，日期为文件名）
    let path = pathInput.value.trim()
    if (!path) path = autoPath()
    const lang = langSelect.value
    try {
      const res = await api.create({ path, lang })
      const cat = catInput.value.trim()
      if (cat) {
        const detail = await api.get(res.path)
        const f = detail.files[lang]
        f.data.category = cat
        await api.save(res.path, lang, { data: f.data, body: f.content })
      }
      toast(`已创建 ${res.path}`)
      overlay.remove()
      navigate(`#/edit/${encodePath(res.path)}`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
}

// 生成 yyyy/yyyy-mm-dd 路径
export function autoPath(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}/${y}-${m}-${d}`
}
