const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

export function getMediaBase() {
  const envBase = import.meta.env.VITE_MEDIA_BASE_URL
  if (envBase) return envBase
  if (typeof apiBase === 'string' && apiBase.startsWith('http')) {
    try {
      const u = new URL(apiBase)
      return `${u.protocol}//${u.host}`
    } catch {
      return ''
    }
  }
  return ''
}

export function withMediaBase(url: string): string
export function withMediaBase(url: null): null
export function withMediaBase(url: undefined): undefined
export function withMediaBase(url: string | null | undefined) {
  if (url == null || url === '') return url
  if (url.startsWith('http')) return url
  const base = getMediaBase()
  return base ? `${base}${url}` : url
}
