import { el } from '../dom'

export type PageKey = 'overview' | 'list' | 'config'

// 顶栏：Logo + 页面导航 + 右侧操作区
export function pageHeader(active: PageKey, right: HTMLElement) {
  return el('header', { class: 'cms-header' }, [
    el('div', { class: 'cms-header-inner' }, [
      el('h1', { class: 'cms-logo' }, [
        'Momo ',
        el('span', { class: 'cms-logo-sub' }, ['CMS']),
      ]),
      el('nav', { class: 'cms-nav' }, [
        el('a', { class: 'cms-nav-link' + (active === 'overview' ? ' active' : ''), href: '#/' }, ['概览']),
        el('a', { class: 'cms-nav-link' + (active === 'list' ? ' active' : ''), href: '#/list' }, ['文章列表']),
        el('a', { class: 'cms-nav-link' + (active === 'config' ? ' active' : ''), href: '#/config' }, ['网站配置']),
      ]),
      right,
    ]),
  ])
}
