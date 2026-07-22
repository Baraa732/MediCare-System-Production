import { useEffect, useRef, useState } from 'react'
import { invalidateDashboardQueries } from '../lib/queryClient'
import { getLiveStreamClient } from '../lib/liveStream'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'

/** Subscribes to platform SSE stream and softly invalidates cached queries (no remount). */
export function useDashboardLive(enabled = false) {
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
      pollIntervalMs: 30_000,
      throttleMs: 5_000,
    })

    const softRefresh = () => {
      const now = Date.now()
      if (now - lastInvalidateRef.current < 5_000) return
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
