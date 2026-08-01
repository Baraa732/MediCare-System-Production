import { QueryClient } from '@tanstack/react-query'
import { LIVE_STALE_TIME } from './livePolling'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: LIVE_STALE_TIME,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

export const queryKeys = {
  observability: (range: string) => ['platform-observability', range] as const,
  platformStats: () => ['platform-stats'] as const,
  platformData: () => ['platform-data'] as const,
  platformHealth: () => ['platform-health'] as const,
  platformLogs: (params: string) => ['platform-logs', params] as const,
  platformIncidents: () => ['platform-incidents'] as const,
}

export function invalidateDashboardQueries() {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0]
      return (
        key === 'platform-observability'
        || key === 'platform-stats'
        || key === 'platform-data'
        || key === 'platform-health'
        || key === 'platform-logs'
        || key === 'platform-incidents'
      )
    },
  })
}
