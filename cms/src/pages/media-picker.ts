// media-picker.ts — 编辑器里的「从媒体库导入」选图弹窗
import { api } from '../api'
import type { MediaItem, MediaScope } from '../types'
import { el } from '../dom'
import { toast } from '../ui'
import {
  createOverlay,
  formatSize,
  imageThumb,
  mediaRef,
} from '../media-shared'

interface PickerOptions {
  /** 弹窗挂载点（编辑器 shell 的 root） */
  root: HTMLElement
  /** 当前文章目录，用于过滤「本文图片」并计算引用路径 */
  articleDir: string
  title?: string
  onPick: (item: MediaItem, scope: MediaScope, ref: string) => void
}

export function openMediaPicker(opts: PickerOptions) {
  let scope: MediaScope = 'blog'
  let q = ''
  let loadSeq = 0
  let timer = 0
  let items: MediaItem[] = []

  const tabBlog = el('button', { class: 'media-tab active', type: 'button', 'aria-selected': 'true' }, ['本文图片'])
  const tabPublic = el('button', { class: 'media-tab', type: 'button', 'aria-selected': 'false' }, ['public 图片'])

  const search = el('input', {
    class: 'input input-search',
    type: 'search',
    placeholder: '搜索文件名 / 路径…',
    oninput: (e: Event) => {
      q = (e.target as HTMLInputElement).value
      clearTimeout(timer)
      timer = window.setTimeout(() => void load(), 250)
    },
  })

  const countEl = el('span', { class: 'cms-count' })
  const grid = el('div', { class: 'picker-grid' }, [el('div', { class: 'picker-empty' }, ['加载中…'])])
  const hint = el('div', { class: 'picker-hint' }, [
    '点击图片插入引用：',
    el('code', {}, ['./images/xxx.png']),
    '（public 图片用 ',
    el('code', {}, ['/xxx.png']),
    '）',
  ])

  const { overlay, close } = createOverlay('media-picker', () => {
    clearTimeout(timer)
    loadSeq++
  })

  function setScope(next: MediaScope) {
    if (scope === next) return
    scope = next
    tabBlog.classList.toggle('active', next === 'blog')
    tabPublic.classList.toggle('active', next === 'public')
    tabBlog.setAttribute('aria-selected', String(next === 'blog'))
    tabPublic.setAttribute('aria-selected', String(next === 'public'))
    void load()
  }
  tabBlog.addEventListener('click', () => setScope('blog'))
  tabPublic.addEventListener('click', () => setScope('public'))

  function inCurrentArticle(item: MediaItem) {
    if (item.articleDir === opts.articleDir) return true
    return item.path.startsWith(opts.articleDir + '/')
  }

  function render() {
    grid.textContent = ''
    countEl.textContent = items.length ? `${items.length} 张` : ''

    if (!items.length) {
      grid.append(
        el('div', { class: 'picker-empty' }, [
          q
            ? '没有匹配的图片'
            : scope === 'blog'
              ? `本文（${opts.articleDir}）还没有图片，可以在媒体库把图片移动/上传到这里。`
              : 'public 下还没有图片。',
        ]),
      )
      return
    }

    for (const item of items) {
      const ref = mediaRef(item, scope, opts.articleDir)
      grid.append(
        el('button', {
          class: 'picker-item',
          type: 'button',
          title: `${item.path}\n点击插入 ${ref}`,
          onclick: () => {
            opts.onPick(item, scope, ref)
            close()
          },
        }, [
          imageThumb(item, 'picker-thumb'),
          el('div', { class: 'picker-name' }, [item.name]),
          el('div', { class: 'picker-sub' }, [
            [
              item.width && item.height ? `${item.width}×${item.height}` : '尺寸未知',
              formatSize(item.size),
            ].join(' · '),
          ]),
          el('div', { class: 'picker-ref' }, [ref]),
        ]),
      )
    }
  }

  async function load() {
    const seq = ++loadSeq
    grid.textContent = ''
    grid.append(el('div', { class: 'picker-empty' }, ['加载中…']))
    try {
      const list = await api.mediaList({ scope, q })
      if (seq !== loadSeq) return
      const all = list.groups.flatMap((group) => group.items)
      items = scope === 'blog' ? all.filter(inCurrentArticle) : all
      render()
    } catch (e) {
      if (seq !== loadSeq) return
      items = []
      grid.textContent = ''
      grid.append(el('div', { class: 'picker-empty' }, [(e as Error).message]))
      toast((e as Error).message, 'error')
    }
  }

  overlay.append(
    el('div', { class: 'media-dialog media-picker-dialog' }, [
      el('button', {
        class: 'media-lightbox-close',
        type: 'button',
        'aria-label': '关闭',
        onclick: () => close(),
      }, ['×']),
      el('h2', { class: 'modal-title' }, [opts.title || '从媒体库选择图片']),
      el('div', { class: 'picker-toolbar' }, [
        el('div', { class: 'media-tabs', role: 'tablist' }, [tabBlog, tabPublic]),
        search,
        countEl,
      ]),
      el('div', { class: 'picker-scroll' }, [grid]),
      hint,
    ]),
  )
  opts.root.append(overlay)
  search.focus()
  void load()
}
