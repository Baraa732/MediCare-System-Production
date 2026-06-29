import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlatformStats } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

export function usePlatformStats(live = false) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const token = resolveSessionToken(storeToken)

  const query = useQuery({
    queryKey: queryKeys.platformStats(),
    queryFn: () => getPlatformStats(token!),
    enabled: (hasHydrated || Boolean(token)) && Boolean(token),
    staleTime: 30_000,
    refetchInterval: live ? 60_000 : false,
    placeholderData: keepPreviousData,
  })

  return {
    stats: query.data ?? null,
    loading: query.isLoading && !query.data,
    fetching: query.isFetching,
    error: query.error ? normalizeError(query.error, 'Could not load platform stats.') : null,
    refresh: () => query.refetch(),
  }
}
