import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { msUntilExpiry } from '../../lib/auth'
import { resolveSessionToken } from '../../lib/sessionToken'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const storeToken = useAuthStore((s) => s.token)
  const token = resolveSessionToken(storeToken)
  const validateSession = useAuthStore((s) => s.validateSession)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  // Re-validate token expiry on every navigation, and schedule an auto-logout
  // for the exact moment the token expires while the app stays open.
  const valid = validateSession()

  useEffect(() => {
    if (!valid || !token) return
    const ttl = msUntilExpiry(token)
    if (ttl <= 0) {
      logout()
      return
    }
    const timer = window.setTimeout(() => logout(), ttl)
    return () => window.clearTimeout(timer)
  }, [valid, token, logout])

  if (!isAuthenticated || !valid) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
