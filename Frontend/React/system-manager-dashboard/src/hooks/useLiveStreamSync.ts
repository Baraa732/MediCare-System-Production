import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getLiveStreamClient } from '../lib/liveStream'
import { LIVE_POLL } from '../lib/livePolling'
import { refetchDashboardQueries, queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import { useDashboardStore } from '../store/dashboardStore'
import { useObservabilityStore } from '../store/observabilityStore'

/** Connects live stream events to React Query cache invalidation (global, all pages). */
export function useLiveStreamSync() {
  const queryClient = useQueryClient()
  const liveEnabled = useObservabilityStore((s) => s.liveStreamEnabled)
  const range = useDashboardStore((s) => s.timeRange)
  const token = resolveSessionToken(useAuthStore((s) => s.token))

  useEffect(() => {
    if (!liveEnabled || !token) return

    const client = getLiveStreamClient({
      pollIntervalMs: LIVE_POLL.streamFallback,
      throttleMs: LIVE_POLL.streamThrottle,
      getToken: () => resolveSessionToken(useAuthStore.getState().token),
    })

    return client.subscribe((event) => {
      if (event.type === 'heartbeat') return

      // Force network refetch — invalidate alone can leave stale UI if queries look fresh.
      if (event.type === 'observability' || event.type === 'logs' || event.type === 'alerts') {
        void refetchDashboardQueries()
        void queryClient.refetchQueries({ queryKey: queryKeys.observability(range), type: 'active' })
      }
    })
  }, [liveEnabled, queryClient, range, token])
}
