import { useQuery } from '@tanstack/react-query'
import { getPlatformObservability } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import type { DashboardTimeRange } from '../store/dashboardStore'
import { normalizeTimeRange, useDashboardStore } from '../store/dashboardStore'
import { queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

function getCookieToken() {
  if (typeof document === 'undefined') return null
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith('sm-auth='))
    ?.split('=')[1]
  return value ? decodeURIComponent(value) : null
}

/** Shared observability query — deduplicated via React Query. */
export function useObservabilityData(explicitRange?: string, live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const storeRange = useDashboardStore((s) => s.timeRange)
  const refreshNonce = useDashboardStore((s) => s.refreshNonce)
  const range: DashboardTimeRange = explicitRange ? normalizeTimeRange(explicitRange) : storeRange
  const token = resolveSessionToken(storeToken) ?? getCookieToken()
  const sessionReady = hasHydrated || Boolean(token)

  const query = useQuery({
    queryKey: [...queryKeys.observability(range), refreshNonce],
    queryFn: ({ signal }) => getPlatformObservability(token!, range, signal),
    enabled: sessionReady && Boolean(token),
    refetchInterval: live ? 1_500 : false,
    staleTime: live ? 1_000 : 4_000,
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? normalizeError(query.error, 'Could not load observability data.') : null,
    refresh: () => query.refetch(),
  }
}
