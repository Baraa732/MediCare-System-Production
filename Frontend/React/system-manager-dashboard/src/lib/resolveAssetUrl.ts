const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()

/**
 * Resolve relative API asset paths (avatars, logos) to a fetchable absolute URL.
 * Dashboard nginx does not proxy /api — VITE_API_BASE_URL must be the public gateway.
 */
export function resolveAssetUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined
  const trimmed = path.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed

  if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
    const origin = API_BASE.replace(/\/api\/?$/, '')
    return trimmed.startsWith('/') ? `${origin}${trimmed}` : `${origin}/${trimmed}`
  }

  // Relative API base (local vite proxy only) — keep path on same origin.
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
