import type { SystemManagerUser } from '../api/types'

export interface JwtPayload {
  sub?: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

/** Decode a JWT payload without verifying the signature (the gateway verifies it). */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/** A token is considered invalid if it cannot be decoded or carries no/expired `exp`. */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true
  const payload = decodeJwt(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return payload.exp <= Math.floor(Date.now() / 1000)
}

/** Milliseconds until the token expires (0 if already expired/invalid). */
export function msUntilExpiry(token: string | null | undefined): number {
  if (!token) return 0
  const payload = decodeJwt(token)
  if (!payload || typeof payload.exp !== 'number') return 0
  return Math.max(0, payload.exp * 1000 - Date.now())
}

export function userFromToken(token: string): SystemManagerUser | null {
  const payload = decodeJwt(token)
  if (!payload?.sub || !payload.username) return null
  return {
    id: payload.sub,
    username: payload.username,
    firstName: payload.firstName ?? payload.username,
    lastName: payload.lastName ?? '',
    email: payload.email,
  }
}
