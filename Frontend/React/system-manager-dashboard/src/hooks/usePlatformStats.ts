import { useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlatformStats } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL, LIVE_STALE_TIME } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

export function usePlatformStats(live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const token = resolveSessionToken(storeToken)
  const enabled = (hasHydrated || Boolean(token)) && Boolean(token)

  const query = useQuery({
    queryKey: queryKeys.platformStats(),
    queryFn: () => getPlatformStats(token!),
    enabled,
    staleTime: live ? 0 : LIVE_STALE_TIME,
    refetchInterval: live ? LIVE_POLL.stats : false,
    refetchOnWindowFocus: true,
    structuralSharing: false,
    placeholderData: keepPreviousData,
  })

  const refetch = query.refetch
  useEffect(() => {
    if (!live || !enabled) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, LIVE_POLL.stats)
    return () => window.clearInterval(id)
  }, [live, enabled, refetch])

  return {
    stats: query.data ?? null,
    loading: query.isLoading && !query.data,
    fetching: query.isFetching,
    error: query.error ? normalizeError(query.error, 'Could not load platform stats.') : null,
    refresh: () => query.refetch(),
  }
}
