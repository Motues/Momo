// 网站配置页的悬浮目录栏（贴在表单右侧）
//
// 只列分区（站点信息 / 主题与动效 / …），点击平滑滚动到位，滚动时自动高亮当前分区。
// 元素挂在 #app 里 + position: fixed（不参与表单布局，路由换页时随 #app 一起销毁）；
// renderBody 每次重建表单后调一次 setSections() 换分区列表，滚动监听只注册一次。
import { el } from '../dom'

export interface TocSection {
  id: string
  title: string
}

export interface ConfigToc {
  el: HTMLElement
  setSections(sections: TocSection[]): void
  destroy(): void
}

const STORE_KEY = 'cms-config-toc'
// 配置内容 max-width 900px 居中：视口宽度够时右侧才放得下目录（再窄就会压到表单）
const WIDE_ENOUGH = 1280
// 吸顶顶栏高度 + 余量：点击滚动的落点与高亮判据都以它为准
const TOP_OFFSET = 78

export function createConfigToc(): ConfigToc {
  let sections: TocSection[] = []
  let items: HTMLButtonElement[] = []
  let currentId = ''
  let raf = 0

  const list = el('nav', { class: 'cfg-toc-list' })
  const toggle = el('button', {
    type: 'button',
    class: 'cfg-toc-toggle',
    title: '收起 / 展开目录',
    'aria-label': '收起或展开目录',
  })
  const root = el('aside', { class: 'cfg-toc' }, [
    el('div', { class: 'cfg-toc-head' }, [el('span', { class: 'cfg-toc-title' }, ['目录']), toggle]),
    list,
  ])

  function readSaved(): string | null {
    try {
      return localStorage.getItem(STORE_KEY)
    } catch {
      return null
    }
  }

  // 展开状态：用户手动收 / 放过就记住；否则默认「窗口够宽才展开」
  function apply(open: boolean, persist: boolean) {
    root.dataset.open = open ? '1' : '0'
    toggle.textContent = open ? '▾' : '▸'
    toggle.setAttribute('aria-expanded', String(open))
    if (persist) {
      try {
        localStorage.setItem(STORE_KEY, open ? 'open' : 'closed')
      } catch {
        /* 隐私模式等场景忽略 */
      }
    }
  }

  const saved = readSaved()
  apply(saved ? saved === 'open' : window.innerWidth >= WIDE_ENOUGH, false)
  toggle.addEventListener('click', () => apply(root.dataset.open !== '1', true))

  function setCurrent(id: string) {
    if (id === currentId) return
    currentId = id
    for (const item of items) {
      const on = item.dataset.id === id
      item.classList.toggle('is-active', on)
      if (on) item.setAttribute('aria-current', 'true')
      else item.removeAttribute('aria-current')
    }
    // 让高亮项在目录里可见：算 offsetTop 自己滚，不用 scrollIntoView——那会把整页也滚了
    const item = items.find((i) => i.dataset.id === id)
    if (!item) return
    const top = item.offsetTop
    const bottom = top + item.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top - 4
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 4
    }
  }

  // 当前分区 = 最后一个「顶部已经越过顶栏」的分区；滚到底时直接认最后一项
  function update() {
    if (!sections.length) return
    const line = TOP_OFFSET + 12
    let active = sections[0].id
    for (const section of sections) {
      const node = document.getElementById(`cfg-${section.id}`)
      if (node && node.getBoundingClientRect().top - line <= 0) active = section.id
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = sections[sections.length - 1].id
    }
    setCurrent(active)
  }

  const onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      update()
    })
  }

  function setSections(next: TocSection[]) {
    sections = next
    items = []
    list.textContent = ''
    for (const section of sections) {
      const item = el(
        'button',
        {
          type: 'button',
          class: 'cfg-toc-item',
          'data-id': section.id,
          title: section.title,
          onclick: () => go(section.id),
        },
        [section.title],
      ) as HTMLButtonElement
      items.push(item)
      list.append(item)
    }
    currentId = ''
    update()
  }

  // 注意：目录项不能是真的 `#anchor` 链接——CMS 是 hash 路由，改 hash 会直接换页
  function go(id: string) {
    const node = document.getElementById(`cfg-${id}`)
    if (!node) return
    const top = node.getBoundingClientRect().top + window.scrollY - TOP_OFFSET
    window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'smooth' })
    setCurrent(id)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)

  return {
    el: root,
    setSections,
    destroy() {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    },
  }
}
