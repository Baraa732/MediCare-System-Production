import { useEffect } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { msUntilExpiry } from '../../lib/auth'
import { resolveSessionToken } from '../../lib/sessionToken'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const storeToken = useAuthStore((s) => s.token)
  const token = resolveSessionToken(storeToken)
  const validateSession = useAuthStore((s) => s.validateSession)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  // Re-validate token expiry on every navigation, and schedule an auto-logout
  // for the exact moment the token expires while the app stays open.
  const valid = hasHydrated ? validateSession() : false

  useEffect(() => {
    if (!hasHydrated || !valid || !token) return
    const ttl = msUntilExpiry(token)
    if (ttl <= 0) {
      logout()
      return
    }
    const timer = window.setTimeout(() => logout(), ttl)
    return () => window.clearTimeout(timer)
  }, [hasHydrated, valid, token, logout])

  // Wait for sessionStorage rehydrate — otherwise first paint redirects to /login
  // and the protected shell never mounts (blank flash / white page).
  if (!hasHydrated) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (!isAuthenticated || !valid) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
