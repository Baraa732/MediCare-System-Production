import { useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getPlatformLogs } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import type { PlatformLogLevel } from '../api/types'
import { applyLogFilters } from '../pages/logs/logUtils'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

/** Server fetch scope — level/service/search filters run client-side for instant UI. */
export interface PlatformLogsParams {
  range?: string
  limit?: number
  services?: string[]
  levels?: PlatformLogLevel[]
  search?: string
}

function serializeFetchParams(params: Pick<PlatformLogsParams, 'range' | 'limit'>): string {
  return JSON.stringify({
    range: params.range ?? '1h',
    limit: params.limit ?? 1000,
  })
}

export function usePlatformLogs(params: PlatformLogsParams = {}, enabled = true, live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const token = resolveSessionToken(storeToken)
  const serialized = serializeFetchParams(params)
  const queryEnabled = (hasHydrated || Boolean(token)) && Boolean(token) && enabled

  const query = useQuery({
    queryKey: queryKeys.platformLogs(serialized),
    queryFn: ({ signal }) =>
      getPlatformLogs(token!, {
        range: params.range,
        limit: params.limit,
        signal,
      }),
    enabled: queryEnabled,
    // Live logs must always be considered stale so invalidate/refetch replaces the table.
    staleTime: live ? 0 : 10_000,
    refetchInterval: live ? LIVE_POLL.logs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
    // Ensure each poll returns a new array reference for the table.
    structuralSharing: false,
  })

  const refetch = query.refetch

  // Belt-and-suspenders: explicit timer so LIVE works even if React Query interval is skipped.
  useEffect(() => {
    if (!live || !queryEnabled) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refetch()
      }
    }, LIVE_POLL.logs)
    return () => window.clearInterval(id)
  }, [live, queryEnabled, refetch, serialized])

  const rawEntries = query.data?.entries ?? []
  const entries = applyLogFilters(rawEntries, {
    services: params.services,
    levels: params.levels,
    search: params.search,
  })

  return {
    data: query.data ?? null,
    rawEntries,
    entries,
    loading: query.isPending && !query.data,
    isRefreshing: query.isFetching && Boolean(query.data),
    error: query.error ? normalizeError(query.error, 'Could not load platform logs.') : null,
    refresh: () => query.refetch(),
  }
}
