import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  timezone: string
  dateFormat: string
  defaultTimeRange: string
  defaultEnvironment: string
  rowsPerPage: number
  sendTelemetry: boolean
  density: 'compact' | 'default' | 'comfortable'
  showSectionLabels: boolean
  showIcons: boolean
  notificationThreshold: 'info' | 'warning' | 'error'
  updateSettings: (settings: Partial<SettingsState>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      defaultTimeRange: 'Last 1h',
      defaultEnvironment: 'production',
      rowsPerPage: 25,
      sendTelemetry: false,
      density: 'default' as const,
      showSectionLabels: true,
      showIcons: true,
      notificationThreshold: 'warning',
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
    }),
    {
      name: 'obsadmin-settings',
      merge: (persisted, current) => {
        const stored = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<SettingsState>
        return {
          ...current,
          ...stored,
          updateSettings: current.updateSettings,
        }
      },
    },
  ),
)
