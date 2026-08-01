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

  const query = useQuery({
    queryKey: queryKeys.observability(range),
    queryFn: ({ signal }) => getPlatformObservability(token!, range, signal),
    enabled: sessionReady && Boolean(token),
    staleTime: live ? 0 : LIVE_STALE_TIME,
    refetchInterval: live ? LIVE_POLL.observability : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    structuralSharing: false,
    placeholderData: keepPreviousData,
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading && !query.data,
    fetching: query.isFetching,
    error: query.error ? normalizeError(query.error, 'Could not load observability data.') : null,
    refresh: () => query.refetch(),
  }
}
