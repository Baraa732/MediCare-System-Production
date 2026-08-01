import { useEffect, useState } from 'react'
import { getLiveStreamClient } from '../lib/liveStream'
import { LIVE_POLL } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import { useForcedLiveRefresh } from './useForcedLiveRefresh'

/**
 * Dashboard live mode:
 * 1) Forced timer refetch (always works — does not depend on SSE)
 * 2) Shared stream client only for LIVE mode indicator
 */
export function useDashboardLive(enabled = true) {
  const [mode, setMode] = useState<'sse' | 'poll' | 'off'>('off')
  const { lastSyncAt } = useForcedLiveRefresh(enabled, LIVE_POLL.observability)

  useEffect(() => {
    if (!enabled) {
      setMode('off')
      return undefined
    }

    const client = getLiveStreamClient({
      getToken: () => resolveSessionToken(useAuthStore.getState().token),
      pollIntervalMs: LIVE_POLL.streamFallback,
      throttleMs: 500,
    })

    setMode(client.getMode())
    const unsubscribe = client.subscribe(() => {
      setMode(client.getMode())
    })

    return unsubscribe
  }, [enabled])

  const resolvedMode: 'sse' | 'poll' | 'off' = !enabled
    ? 'off'
    : mode === 'off'
      ? 'poll'
      : mode

  return {
    mode: resolvedMode,
    lastSyncAt,
    live: enabled,
  }
}
