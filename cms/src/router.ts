export type Route =
  | { name: 'overview' }
  | { name: 'list' }
  | { name: 'config' }
  | { name: 'edit'; path: string }

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '')
  const parts = h.split('/').filter(Boolean)
  if (parts[0] === 'edit' && parts.length >= 2) {
    return { name: 'edit', path: parts.slice(1).map(decodeURIComponent).join('/') }
  }
  if (parts[0] === 'list') return { name: 'list' }
  if (parts[0] === 'config') return { name: 'config' }
  return { name: 'overview' }
}

export function navigate(hash: string) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = hash
  }
}
