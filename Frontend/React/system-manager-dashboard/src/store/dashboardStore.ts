import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Shared observability window — synced with Topbar. */
export type DashboardTimeRange = '1h' | '24h' | '7d' | '30d'

interface DashboardState {
  timeRange: DashboardTimeRange
  setTimeRange: (range: DashboardTimeRange) => void
  /** Bumped on manual refresh to invalidate React Query caches. */
  refreshNonce: number
  triggerRefresh: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      timeRange: '1h',
      setTimeRange: (timeRange) => set({ timeRange }),
      refreshNonce: 0,
      triggerRefresh: () => set((state) => ({ refreshNonce: state.refreshNonce + 1 })),
    }),
    { name: 'sm-dashboard-context', partialize: (state) => ({ timeRange: state.timeRange }) },
  ),
)

/** Map legacy range strings from logs/other pages to dashboard store values. */
export function normalizeTimeRange(range: string): DashboardTimeRange {
  if (range === '24h' || range === '7d' || range === '30d') return range
  if (range === '6h' || range === '15m') return '1h'
  return '1h'
}
