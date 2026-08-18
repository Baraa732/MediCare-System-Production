import { useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPrometheusAlerts } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL, LIVE_STALE_TIME } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

export function usePrometheusAlerts(live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const token = resolveSessionToken(storeToken)
  const enabled = (hasHydrated || Boolean(token)) && Boolean(token)

  const query = useQuery({
    queryKey: queryKeys.prometheusAlerts(),
    queryFn: ({ signal }) => getPrometheusAlerts(token!, signal),
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
  }, [live, enabled, refetch])

  return {
    data: query.data ?? null,
    loading: query.isLoading && !query.data,
    error: query.error ? normalizeError(query.error, 'Could not load Prometheus alerts.') : null,
    refresh: () => query.refetch(),
  }
}
