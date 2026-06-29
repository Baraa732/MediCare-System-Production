import { useQuery } from '@tanstack/react-query'
import { getPlatformStats } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import { useDashboardStore } from '../store/dashboardStore'

export function usePlatformStats() {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const refreshNonce = useDashboardStore((s) => s.refreshNonce)
  const token = resolveSessionToken(storeToken)

  const query = useQuery({
    queryKey: [...queryKeys.platformStats(), refreshNonce],
    queryFn: () => getPlatformStats(token!),
    enabled: (hasHydrated || Boolean(token)) && Boolean(token),
    staleTime: 30_000,
  })

  return {
    stats: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? normalizeError(query.error, 'Could not load platform stats.') : null,
    refresh: () => query.refetch(),
  }
}
