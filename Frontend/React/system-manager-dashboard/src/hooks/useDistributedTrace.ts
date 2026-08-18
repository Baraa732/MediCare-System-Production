import { useQuery } from '@tanstack/react-query'
import { getDistributedTrace } from '../api/systemManager'
import { queryKeys } from '../lib/queryClient'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

export function useDistributedTrace(traceId: string | null) {
  const storeToken = useAuthStore((s) => s.token)
  const token = resolveSessionToken(storeToken)

  const query = useQuery({
    queryKey: queryKeys.distributedTrace(traceId ?? ''),
    queryFn: () => getDistributedTrace(token!, traceId!),
    enabled: Boolean(token && traceId),
    staleTime: 15_000,
    retry: 1,
  })

  return {
    trace: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
  }
}
