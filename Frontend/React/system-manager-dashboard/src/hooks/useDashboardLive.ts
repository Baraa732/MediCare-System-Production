import { useEffect, useRef, useState } from 'react'
import { invalidateDashboardQueries } from '../lib/queryClient'
import { getLiveStreamClient } from '../lib/liveStream'
import { LIVE_POLL } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

/** Subscribes to platform SSE stream and softly invalidates cached queries (no remount). */
export function useDashboardLive(enabled = true) {
  const storeToken = useAuthStore((s) => s.token)
  const [mode, setMode] = useState<'sse' | 'poll' | 'off'>('off')
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const lastInvalidateRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setMode('off')
      return undefined
    }

    const token = resolveSessionToken(storeToken)
    const client = getLiveStreamClient({
      getToken: () => token,
      pollIntervalMs: LIVE_POLL.streamFallback,
      throttleMs: LIVE_POLL.streamThrottle,
    })

    const softRefresh = () => {
      const now = Date.now()
      if (now - lastInvalidateRef.current < LIVE_POLL.streamThrottle) return
      lastInvalidateRef.current = now
      void invalidateDashboardQueries()
      setLastSyncAt(now)
    }

    const unsubscribe = client.subscribe((event) => {
      if (event.type === 'heartbeat') {
        setMode(client.getMode())
        return
      }
      softRefresh()
      setMode(client.getMode())
    })

    setMode(client.getMode())
    return unsubscribe
  }, [enabled, storeToken])

  return { mode, lastSyncAt, live: enabled }
}
