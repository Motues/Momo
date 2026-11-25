import type {
  ArticleDetail,
  ArticleSummary,
  BatchUpdateResult,
  ConfigDoc,
  ConfigValues,
  FrontmatterData,
  MediaEstimate,
  MediaList,
  MediaMoveResult,
  MediaRefs,
  MediaScope,
  MediaUnused,
  MediaUploadResult,
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

  create(body: { path: string; lang: string; title?: string; category?: string }) {
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

  // ---- 媒体库 ----
  mediaList(params: { scope: MediaScope; q?: string }) {
    const sp = new URLSearchParams({ scope: params.scope })
    if (params.q) sp.set('q', params.q)
    return req<MediaList>(`/api/media?${sp.toString()}`)
  },

  mediaUpload(file: File, scope: MediaScope, dir: string, quality = 82) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('scope', scope)
    fd.append('dir', dir)
    fd.append('quality', String(quality))
    return req<MediaUploadResult>('/api/media/upload', { method: 'POST', body: fd })
  },

  // 只预估压缩后大小（与上传走同一套 sharp 参数），不写盘
  mediaEstimate(file: File, quality: number) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('quality', String(quality))
    return req<MediaEstimate>('/api/media/estimate', { method: 'POST', body: fd })
  },

  mediaRemove(scope: MediaScope, path: string) {
    const sp = new URLSearchParams({ scope, path })
    return req<{ ok: boolean; path: string }>(`/api/media?${sp.toString()}`, { method: 'DELETE' })
  },

  mediaRename(scope: MediaScope, path: string, name: string) {
    return req<MediaUploadResult>('/api/media', {
      method: 'PATCH',
      body: JSON.stringify({ scope, path, name }),
    })
  },

  // 原路径替换图片内容（保持引用不变）
  mediaReplace(scope: MediaScope, path: string, file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('scope', scope)
    fd.append('path', path)
    return req<MediaUploadResult>('/api/media/replace', { method: 'POST', body: fd })
  },

  // 移动到其他博客目录 / public 目录（不会自动改写文章引用）
  mediaMove(body: { scope: MediaScope; path: string; targetScope: MediaScope; targetDir: string }) {
    return req<MediaMoveResult>('/api/media/move', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  mediaRefs(scope: MediaScope, path: string) {
    const sp = new URLSearchParams({ scope, path })
    return req<MediaRefs>(`/api/media/refs?${sp.toString()}`)
  },

  mediaUnused(scope: MediaScope) {
    return req<MediaUnused>(`/api/media/unused?scope=${encodeURIComponent(scope)}`)
  },

  // ---- 批量操作 ----
  batchUpdate(paths: string[], action: string, value?: string) {
    return req<BatchUpdateResult>('/api/batch/update', {
      method: 'POST',
      body: JSON.stringify({ paths, action, value }),
    })
  },

  batchExportUrl(paths: string[]) {
    return `/api/batch/export?paths=${paths.map(encodeURIComponent).join(',')}`
  },
}
