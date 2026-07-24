import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { login as apiLogin } from '../api/systemManager'
import { toLoginErrorMessage } from '../api/errors'
import { isTokenExpired, userFromToken } from '../lib/auth'
import { getCookieToken, registerStoreTokenReader, resolveSessionToken } from '../lib/sessionToken'
import { ApiError, type SystemManagerUser } from '../api/types'
export interface SessionUser extends SystemManagerUser {
  name: string
  avatar: string
  role: 'admin'
}

const COOKIE_NAME = 'sm-auth'
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 days, matches gateway JWT lifetime

// Brute-force deterrent (client-side UX guard; real rate limiting lives in the gateway).
const MAX_ATTEMPTS = 5
const LOCK_MS = 60_000

function buildSessionUser(u: SystemManagerUser): SessionUser {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username
  const initials =
    [u.firstName, u.lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join('')
      .toUpperCase() || u.username.slice(0, 2).toUpperCase()
  return { ...u, name, avatar: initials, role: 'admin' }
}

function setSecureCookie(token: string) {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Strict${secure}`
}

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict`
}

interface AuthState {
  user: SessionUser | null
  token: string | null
  isAuthenticated: boolean
  failedAttempts: number
  lockedUntil: number | null
  _hasHydrated: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  /** Re-checks token validity; logs out and returns false if expired. */
  validateSession: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      failedAttempts: 0,
      lockedUntil: null,
      _hasHydrated: false,

      login: async (username, password) => {
        const { lockedUntil } = get()
        if (lockedUntil && Date.now() < lockedUntil) {
          const secs = Math.ceil((lockedUntil - Date.now()) / 1000)
          return { success: false, error: `Too many attempts. Try again in ${secs}s.` }
        }

        try {
          const session = await apiLogin(username.trim(), password)
          if (!session?.accessToken || isTokenExpired(session.accessToken)) {
            return { success: false, error: 'The server returned an invalid session token.' }
          }
          // Prefer server-provided user, fall back to JWT claims.
          const baseUser = session.user ?? userFromToken(session.accessToken)
          if (!baseUser) {
            return { success: false, error: 'Could not read account details from the session.' }
          }
          set({
            user: buildSessionUser(baseUser),
            token: session.accessToken,
            isAuthenticated: true,
            failedAttempts: 0,
            lockedUntil: null,
          })
          setSecureCookie(session.accessToken)
          return { success: true }
        } catch (err) {
          const base = toLoginErrorMessage(err)
          // Only genuine credential rejections count toward lockout — a network
          // outage or server error must not lock the administrator out.
          const isCredentialFailure = err instanceof ApiError && (err.status === 400 || err.status === 401)
          if (!isCredentialFailure) {
            return { success: false, error: base }
          }
          const attempts = get().failedAttempts + 1
          const locked = attempts >= MAX_ATTEMPTS
          set({
            failedAttempts: locked ? 0 : attempts,
            lockedUntil: locked ? Date.now() + LOCK_MS : null,
          })
          const remaining = MAX_ATTEMPTS - attempts
          return {
            success: false,
            error: locked
              ? `Too many failed attempts. Locked for ${LOCK_MS / 1000}s.`
              : remaining <= 2 && remaining > 0
                ? `${base} (${remaining} attempt${remaining === 1 ? '' : 's'} left)`
                : base,
          }
        }
      },

      logout: () => {
        clearCookie()
        set({ user: null, token: null, isAuthenticated: false })
      },

      validateSession: () => {
        const { isAuthenticated } = get()
        if (!isAuthenticated) return false
        const token = resolveSessionToken(get().token)
        if (!token || isTokenExpired(token)) {
          clearCookie()
          set({ user: null, token: null, isAuthenticated: false })
          return false
        }
        if (token !== get().token) {
          set({ token })
        }
        return true
      },
    }),
    {
      name: 'system-manager-auth',
      // sessionStorage is cleared when the browser tab closes — narrower exposure
      // window than localStorage for an admin console.
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.sessionStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.token && isTokenExpired(state.token)) {
            state.user = null
            state.token = null
            state.isAuthenticated = false
          } else if (!state.token) {
            const cookieToken = getCookieToken()
            if (cookieToken && !isTokenExpired(cookieToken)) {
              state.token = cookieToken
              state.isAuthenticated = true
              if (!state.user) {
                const baseUser = userFromToken(cookieToken)
                if (baseUser) state.user = buildSessionUser(baseUser)
              }
            }
          }
        }
        useAuthStore.setState({ _hasHydrated: true })
      },
    },
  ),
)

// Synchronous sessionStorage hydrates DURING create(), before `useAuthStore` is
// assigned — so the onRehydrateStorage finalizer's setState is thrown away (TDZ)
// and onFinishHydration never fires for that initial pass. If we don't resolve the
// flag here, `_hasHydrated` stays false forever and any UI gated on it hangs.
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ _hasHydrated: true })
}

// Covers async storage / manual rehydrate() calls.
useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.setState({ _hasHydrated: true })
})

registerStoreTokenReader(() => useAuthStore.getState().token)
