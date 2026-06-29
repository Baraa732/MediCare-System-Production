import { useQuery } from '@tanstack/react-query'
import { getPlatformLogs } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import type { PlatformLogLevel } from '../api/types'
import { queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import { useDashboardStore } from '../store/dashboardStore'

export interface PlatformLogsParams {
  services?: string[]
  levels?: PlatformLogLevel[]
  search?: string
  range?: string
  limit?: number
}

function serializeParams(params: PlatformLogsParams): string {
  return JSON.stringify({
    services: params.services?.sort(),
    levels: params.levels?.sort(),
    search: params.search ?? '',
    range: params.range ?? '1h',
    limit: params.limit ?? 1000,
  })
}

export function usePlatformLogs(params: PlatformLogsParams, enabled = true, live = true) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const refreshNonce = useDashboardStore((s) => s.refreshNonce)
  const token = resolveSessionToken(storeToken)
  const serialized = serializeParams(params)

  const query = useQuery({
    queryKey: [...queryKeys.platformLogs(serialized), refreshNonce],
    queryFn: ({ signal }) => getPlatformLogs(token!, { ...params, signal }),
    enabled: (hasHydrated || Boolean(token)) && Boolean(token) && enabled,
    staleTime: live ? 2_000 : 30_000,
    refetchInterval: live ? 5_000 : false,
  })

  return {
    data: query.data ?? null,
    entries: query.data?.entries ?? [],
    loading: query.isLoading,
    error: query.error ? normalizeError(query.error, 'Could not load platform logs.') : null,
    refresh: () => query.refetch(),
  }
}
