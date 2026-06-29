import { create } from 'zustand'
import type { PlatformLogLevel } from '../api/types'

export interface LogsNavigationFilters {
  services?: string[]
  levels?: PlatformLogLevel[]
  search?: string
  severity?: 'critical' | 'high' | 'warning'
}

interface LogsFilterState {
  pendingFilters: LogsNavigationFilters | null
  setPendingFilters: (filters: LogsNavigationFilters) => void
  consumePendingFilters: () => LogsNavigationFilters | null
}

export const useLogsFilterStore = create<LogsFilterState>((set, get) => ({
  pendingFilters: null,
  setPendingFilters: (filters) => set({ pendingFilters: filters }),
  consumePendingFilters: () => {
    const filters = get().pendingFilters
    set({ pendingFilters: null })
    return filters
  },
}))

/** Map incident/treemap severity to log levels. */
export function severityToLogLevels(severity?: string): PlatformLogLevel[] {
  if (severity === 'critical' || severity === 'high') return ['ERROR']
  if (severity === 'warning') return ['ERROR', 'WARN']
  return ['ERROR']
}

export function parseLogsSearchParams(params: URLSearchParams): LogsNavigationFilters {
  const service = params.get('service')
  const level = params.get('level')
  const search = params.get('search')
  const severity = params.get('severity') as LogsNavigationFilters['severity'] | null

  const filters: LogsNavigationFilters = {}
  if (service) filters.services = service.split(',').filter(Boolean)
  if (level) {
    filters.levels = level.split(',').filter(Boolean) as PlatformLogLevel[]
  } else if (severity) {
    filters.levels = severityToLogLevels(severity)
  }
  if (search) filters.search = search
  if (severity) filters.severity = severity
  return filters
}

export function buildLogsUrl(filters: LogsNavigationFilters): string {
  const params = new URLSearchParams()
  if (filters.services?.length) params.set('service', filters.services.join(','))
  if (filters.levels?.length) params.set('level', filters.levels.join(','))
  if (filters.search) params.set('search', filters.search)
  if (filters.severity) params.set('severity', filters.severity)
  const qs = params.toString()
  return qs ? `/logs?${qs}` : '/logs'
}
