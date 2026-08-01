import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Hard live refresh for the Command Center.
 * Does not depend on SSE / EventSource — those can fail auth or get throttled.
 * Always refetches active dashboard queries on a timer while enabled.
 */
export function useForcedLiveRefresh(enabled: boolean, intervalMs: number) {
  const queryClient = useQueryClient()
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      if (inFlight.current) return
      inFlight.current = true
      try {
        await queryClient.refetchQueries({
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
          type: 'active',
        })
        setLastSyncAt(Date.now())
        setTick((n) => n + 1)
      } finally {
        inFlight.current = false
      }
    }

    // Immediate refresh when live turns on / page mounts.
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, intervalMs, queryClient])

  return { lastSyncAt, tick }
}
