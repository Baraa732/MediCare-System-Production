const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Resolve relative API asset paths (avatars, logos) to a fetchable URL. */
export function resolveAssetUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const origin = API_BASE.replace(/\/api\/?$/, '')
  if (path.startsWith('/')) return `${origin}${path}`
  return `${origin}/${path}`
}
