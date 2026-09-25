import type {
  ArticleDetail,
  ArticleSummary,
  ConfigDoc,
  ConfigValues,
  FrontmatterData,
  MetaInfo,
  Stats,
} from './types'

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`)
  return data as T
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

export const api = {
  list(params: { q?: string; category?: string; draft?: string } = {}) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.category) sp.set('category', params.category)
    if (params.draft) sp.set('draft', params.draft)
    const qs = sp.toString()
    return req<{ articles: ArticleSummary[] }>(`/api/articles${qs ? '?' + qs : ''}`)
  },

  get(path: string) {
    return req<ArticleDetail>(`/api/articles/${encodePath(path)}`)
  },

  create(body: { path: string; lang: string }) {
    return req<{ path: string }>('/api/articles', { method: 'POST', body: JSON.stringify(body) })
  },

  save(path: string, lang: string, body: { data: FrontmatterData; body: string }) {
    return req<{ path: string }>(`/api/articles/${encodePath(path)}/${lang}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  remove(path: string) {
    return req<{ ok: boolean }>(`/api/articles/${encodePath(path)}`, { method: 'DELETE' })
  },

  // 实时预览：返回完整 HTML 文档字符串（用于 iframe srcdoc）
  async preview(body: { data: FrontmatterData; body: string; base: string; lang?: string }) {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || '预览失败')
    }
    return res.text()
  },

  upload(file: File, path: string) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('path', path)
    return req<{ name: string; url: string }>('/api/upload', { method: 'POST', body: fd })
  },

  meta() {
    return req<MetaInfo>('/api/meta')
  },

  stats() {
    return req<Stats>('/api/stats')
  },

  // 站点配置（src/config.ts）
  getConfig() {
    return req<ConfigDoc>('/api/config')
  },

  saveConfig(values: ConfigValues) {
    return req<ConfigDoc>('/api/config', { method: 'PUT', body: JSON.stringify({ values }) })
  },

  // 用系统默认的文件管理器打开文章文件夹
  reveal(path: string) {
    return req<{ ok: boolean; dir: string }>('/api/reveal', {
      method: 'POST',
      body: JSON.stringify({ path }),
    })
  },
}
