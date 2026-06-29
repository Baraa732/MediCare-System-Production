/** Read the platform-admin JWT from the sm-auth cookie (set on login). */
export function getCookieToken(): string | null {
  if (typeof document === 'undefined') return null
  const value = document.cookie.split('; ').find((row) => row.startsWith('sm-auth='))?.split('=')[1]
  return value ? decodeURIComponent(value) : null
}

/** Session token from zustand or cookie — usable before persist hydration finishes. */
export function resolveSessionToken(storeToken: string | null | undefined): string | null {
  return storeToken ?? getCookieToken()
}
