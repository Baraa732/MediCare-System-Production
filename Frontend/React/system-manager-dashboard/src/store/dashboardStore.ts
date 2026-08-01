import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Shared observability window — synced with Topbar. */
export type DashboardTimeRange = '15m' | '1h' | '6h' | '24h' | '7d' | '30d'

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
  if (
    range === '15m' ||
    range === '1h' ||
    range === '6h' ||
    range === '24h' ||
    range === '7d' ||
    range === '30d'
  ) {
    return range
  }
  if (range === 'Last 15m') return '15m'
  if (range === 'Last 1h') return '1h'
  if (range === 'Last 24h') return '24h'
  if (range === 'Last 7d') return '7d'
  if (range === 'Last 30d') return '30d'
  return '1h'
}

export function timeRangeLabel(range: DashboardTimeRange): string {
  const map: Record<DashboardTimeRange, string> = {
    '15m': 'Last 15m',
    '1h': 'Last 1h',
    '6h': 'Last 1h',
    '24h': 'Last 24h',
    '7d': 'Last 7d',
    '30d': 'Last 30d',
  }
  return map[range]
}
