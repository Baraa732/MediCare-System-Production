import { useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlatformObservability } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import type { DashboardTimeRange } from '../store/dashboardStore'
import { normalizeTimeRange, useDashboardStore } from '../store/dashboardStore'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL, LIVE_STALE_TIME } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

/** Shared observability query — deduplicated via React Query. */
export function useObservabilityData(explicitRange?: string, live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const storeRange = useDashboardStore((s) => s.timeRange)
  const range: DashboardTimeRange = explicitRange ? normalizeTimeRange(explicitRange) : storeRange
  const token = resolveSessionToken(storeToken)
  const sessionReady = hasHydrated || Boolean(token)
  const enabled = sessionReady && Boolean(token)

  const query = useQuery({
    queryKey: queryKeys.observability(range),
    queryFn: ({ signal }) => getPlatformObservability(token!, range, signal),
    enabled,
    staleTime: live ? 0 : LIVE_STALE_TIME,
    gcTime: 5 * 60_000,
    refetchInterval: live ? LIVE_POLL.observability : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    structuralSharing: false,
    placeholderData: keepPreviousData,
  })

  const refetch = query.refetch

  // Explicit timer — React Query refetchInterval alone has been unreliable here.
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
    error: query.error ? normalizeError(query.error, 'Could not load observability data.') : null,
    refresh: () => query.refetch(),
    dataUpdatedAt: query.dataUpdatedAt,
  }
}
