import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getPlatformLogs } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import type { PlatformLogLevel } from '../api/types'
import { applyLogFilters } from '../pages/logs/logUtils'
import { queryKeys } from '../lib/queryClient'
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

  const query = useQuery({
    queryKey: queryKeys.platformLogs(serialized),
    queryFn: ({ signal }) =>
      getPlatformLogs(token!, {
        range: params.range,
        limit: params.limit,
        signal,
      }),
    enabled: (hasHydrated || Boolean(token)) && Boolean(token) && enabled,
    staleTime: 30_000,
    refetchInterval: live ? 60_000 : false,
    placeholderData: keepPreviousData,
  })

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
