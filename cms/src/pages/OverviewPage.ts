import { api } from '../api'
import type { ArticleSummary, Stats } from '../types'
import { el, encodePath, escapeHtml } from '../dom'
import { pageHeader } from './header'
import { openNewModal } from './new-article'

const fmt = new Intl.NumberFormat('zh-CN')

export async function renderOverview(root: HTMLElement) {
  const main = el('main', { class: 'cms-main' }, [
    el('div', { class: 'cms-empty' }, ['加载统计中…']),
  ])
  root.append(
    pageHeader(
      'overview',
      el('button', { class: 'btn btn-primary', id: 'btn-new', onclick: () => openNewModal(root, categories) }, [
        '＋ 新建文章',
      ]),
    ),
    main,
  )

  let categories: string[] = []
  try {
    const stats = await api.stats()
    categories = stats.categories.map((c) => c.name)
    main.innerHTML = ''
    renderStats(main, stats)
  } catch (e) {
    main.innerHTML = ''
    main.append(el('div', { class: 'cms-error' }, [escapeHtml((e as Error).message)]))
  }
}

function renderStats(main: HTMLElement, s: Stats) {
  const card = (label: string, value: string, sub = '') =>
    el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-label' }, [label]),
      el('div', { class: 'stat-value' }, [value]),
      sub ? el('div', { class: 'stat-sub' }, [sub]) : null,
    ])

  const publishPct = s.total ? Math.round((s.published / s.total) * 100) : 0

  main.append(
    el('div', { class: 'stat-grid' }, [
      card('文章总数', fmt.format(s.total)),
      card('已发布', fmt.format(s.published), `占全部 ${publishPct}%`),
      card('草稿', fmt.format(s.drafts)),
      card('置顶', fmt.format(s.pinned)),
      card('分类数', fmt.format(s.categories.length)),
      card('正文总字数', fmt.format(s.words.total), `中文 ${fmt.format(s.words.cjk)} · 英文 ${fmt.format(s.words.latin)}`),
    ]),
    el('div', { class: 'overview-cols' }, [
      categoryPanel(s),
      langPanel(s),
    ]),
    recentPanel(s),
  )
}

function categoryPanel(s: Stats) {
  const max = s.categories.length ? s.categories[0].count : 0
  const rows =
    s.categories.length === 0
      ? el('div', { class: 'panel-empty' }, ['暂无分类'])
      : el('div', { class: 'bar-list' }, s.categories.map((c) => barRow(c.name, c.count, max)))
  return el('div', { class: 'panel' }, [
    el('h2', { class: 'panel-title' }, ['分类分布']),
    rows,
  ])
}

function barRow(name: string, count: number, max: number) {
  const pct = max ? Math.round((count / max) * 100) : 0
  return el('div', { class: 'bar-row' }, [
    el('span', { class: 'bar-label', title: name }, [name]),
    el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: `width: ${pct}%` })]),
    el('span', { class: 'bar-count' }, [String(count)]),
  ])
}

function langPanel(s: Stats) {
  const zh = s.langs['zh-cn'] || 0
  const en = s.langs['en'] || 0
  const zhOnly = Math.max(0, zh - s.both)
  const enOnly = Math.max(0, en - s.both)
  const total = Math.max(1, s.total)
  const seg = (w: number, cls: string, title: string) =>
    el('span', { class: cls, title, style: `width: ${(w / total) * 100}%` })

  return el('div', { class: 'panel' }, [
    el('h2', { class: 'panel-title' }, ['语言版本']),
    el('div', { class: 'lang-bar' }, [
      seg(zhOnly, 'lang-seg lang-seg-zh', `仅中文 ${zhOnly}`),
      seg(s.both, 'lang-seg lang-seg-both', `双语 ${s.both}`),
      seg(enOnly, 'lang-seg lang-seg-en', `仅英文 ${enOnly}`),
    ]),
    el('div', { class: 'lang-legend' }, [
      el('span', { class: 'legend-item' }, [el('i', { class: 'legend-dot lang-seg-zh' }), `中文版 ${fmt.format(zh)}`]),
      el('span', { class: 'legend-item' }, [el('i', { class: 'legend-dot lang-seg-both' }), `双语 ${fmt.format(s.both)}`]),
      el('span', { class: 'legend-item' }, [el('i', { class: 'legend-dot lang-seg-en' }), `英文版 ${fmt.format(en)}`]),
    ]),
  ])
}

function recentPanel(s: Stats) {
  const list =
    s.recent.length === 0
      ? el('div', { class: 'panel-empty' }, ['暂无文章，点击右上角「新建文章」开始创作'])
      : el('div', { class: 'recent-list' }, s.recent.map((a) => recentItem(a)))
  return el('div', { class: 'panel' }, [
    el('h2', { class: 'panel-title' }, ['最近文章']),
    list,
    s.recent.length > 0 ? el('a', { class: 'recent-more', href: '#/list' }, ['查看全部文章 →']) : null,
  ])
}

function recentItem(a: ArticleSummary) {
  const badges: (HTMLElement | string)[] = []
  if (a.draft) badges.push(el('span', { class: 'badge badge-draft' }, ['草稿']))
  if (a.pinTop) badges.push(el('span', { class: 'badge badge-pin' }, ['置顶']))
  return el('a', { class: 'recent-item', href: `#/edit/${encodePath(a.path)}` }, [
    el('div', { class: 'recent-main' }, [
      el('div', { class: 'recent-title' }, [a.title || a.path]),
      el('div', { class: 'recent-meta' }, [
        a.category ? el('span', { class: 'tag' }, [a.category]) : null,
        el('span', {}, [a.pubDate || '—']),
        el('span', { class: 'recent-path' }, [a.path]),
      ]),
    ]),
    el('div', { class: 'recent-badges' }, badges),
  ])
}
