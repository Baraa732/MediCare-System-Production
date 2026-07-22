const COOKIE_PREFIX = 'sm-auth='

let readStoreToken: (() => string | null | undefined) | null = null

/** Register zustand token reader (called once from authStore). */
export function registerStoreTokenReader(reader: () => string | null | undefined): void {
  readStoreToken = reader
}

/** Read the platform-admin JWT from the sm-auth cookie (set on login). */
export function getCookieToken(): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const row = part.trim()
    if (!row.startsWith(COOKIE_PREFIX)) continue
    const value = row.slice(COOKIE_PREFIX.length)
    return value ? decodeURIComponent(value) : null
  }
  return null
}

/** Session token from zustand or cookie — usable before persist hydration finishes. */
export function resolveSessionToken(storeToken: string | null | undefined): string | null {
  return storeToken ?? getCookieToken()
}

/** Active session token for API calls (store + cookie fallback). */
export function getActiveSessionToken(): string | null {
  return resolveSessionToken(readStoreToken?.())
}
