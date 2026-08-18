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
  securitySummary: (range: string) => ['platform-security-summary', range] as const,
  queues: () => ['platform-queues'] as const,
  deployments: () => ['platform-deployments'] as const,
  prometheusAlerts: () => ['platform-prometheus-alerts'] as const,
}

/** Live telemetry keys only — clinics/users (platform-data) stay manual. */
function isLiveDashboardQueryKey(key: unknown): boolean {
  return (
    key === 'platform-observability'
    || key === 'platform-stats'
    || key === 'platform-health'
    || key === 'platform-logs'
    || key === 'platform-incidents'
    || key === 'platform-security-summary'
    || key === 'platform-queues'
    || key === 'platform-deployments'
    || key === 'platform-prometheus-alerts'
  )
}

export function invalidateDashboardQueries() {
  return queryClient.invalidateQueries({
    predicate: (query) => isLiveDashboardQueryKey(query.queryKey[0]),
    refetchType: 'active',
  })
}

/** Force an immediate network refetch of active live dashboard queries. */
export function refetchDashboardQueries() {
  return queryClient.refetchQueries({
    predicate: (query) => isLiveDashboardQueryKey(query.queryKey[0]),
    type: 'active',
  })
}
