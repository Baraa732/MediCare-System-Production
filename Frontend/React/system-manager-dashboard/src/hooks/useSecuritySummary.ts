import { useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getSecuritySummary } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { normalizeTimeRange, useDashboardStore } from '../store/dashboardStore'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL, LIVE_STALE_TIME } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

export function useSecuritySummary(explicitRange?: string, live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const storeRange = useDashboardStore((s) => s.timeRange)
  const range = explicitRange ? normalizeTimeRange(explicitRange) : storeRange
  const token = resolveSessionToken(storeToken)
  const enabled = (hasHydrated || Boolean(token)) && Boolean(token)

  const query = useQuery({
    queryKey: queryKeys.securitySummary(range),
    queryFn: ({ signal }) => getSecuritySummary(token!, range, signal),
    enabled,
    staleTime: live ? 0 : LIVE_STALE_TIME,
    refetchInterval: live ? LIVE_POLL.observability : false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })

  const refetch = query.refetch
  useEffect(() => {
    if (!live || !enabled) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, LIVE_POLL.observability)
    return () => window.clearInterval(id)
  }, [live, enabled, refetch, range])

  return {
    data: query.data ?? null,
    loading: query.isLoading && !query.data,
    fetching: query.isFetching,
    error: query.error
      ? normalizeError(query.error, 'Could not load security summary.')
      : null,
    refresh: () => query.refetch(),
    dataUpdatedAt: query.dataUpdatedAt,
  }
}
