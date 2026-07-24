import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getLiveStreamClient } from '../lib/liveStream'
import { queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import { useDashboardStore } from '../store/dashboardStore'
import { useObservabilityStore } from '../store/observabilityStore'

/** Connects live stream events to React Query cache invalidation. */
export function useLiveStreamSync() {
  const queryClient = useQueryClient()
  const liveEnabled = useObservabilityStore((s) => s.liveStreamEnabled)
  const range = useDashboardStore((s) => s.timeRange)
  const token = resolveSessionToken(useAuthStore((s) => s.token))

  useEffect(() => {
    if (!liveEnabled) return

    const client = getLiveStreamClient({
      // Soft nudge only — must stay slower than overview cache / staleTime.
      pollIntervalMs: 60_000,
      throttleMs: 5_000,
      getToken: () => token,
    })

    return client.subscribe((event) => {
      if (event.type === 'heartbeat') return
      if (event.type === 'observability') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.observability(range) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.platformStats() })
      }
      if (event.type === 'logs') {
        void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'platform-logs' })
      }
      if (event.type === 'alerts') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.observability(range) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.platformIncidents() })
      }
    })
  }, [liveEnabled, queryClient, range, token])
}
