import { create } from 'zustand'

interface ObservabilityUiState {
  liveStreamEnabled: boolean
  setLiveStreamEnabled: (enabled: boolean) => void
  selectedServiceName: string | null
  setSelectedServiceName: (name: string | null) => void
  selectedEdge: { source: string; target: string } | null
  setSelectedEdge: (edge: { source: string; target: string } | null) => void
  selectedIncidentId: string | null
  setSelectedIncidentId: (id: string | null) => void
  logsStreamPaused: boolean
  setLogsStreamPaused: (paused: boolean) => void
  logsAutoScroll: boolean
  setLogsAutoScroll: (auto: boolean) => void
}

export const useObservabilityStore = create<ObservabilityUiState>((set) => ({
  // Off by default — the previous default (true) opened an SSE/poll loop on every
  // AppShell mount that invalidated heavy observability queries every ~1.5s.
  liveStreamEnabled: false,
  setLiveStreamEnabled: (liveStreamEnabled) => set({ liveStreamEnabled }),
  selectedServiceName: null,
  setSelectedServiceName: (selectedServiceName) => set({ selectedServiceName }),
  selectedEdge: null,
  setSelectedEdge: (selectedEdge) => set({ selectedEdge }),
  selectedIncidentId: null,
  setSelectedIncidentId: (selectedIncidentId) => set({ selectedIncidentId }),
  logsStreamPaused: false,
  setLogsStreamPaused: (logsStreamPaused) => set({ logsStreamPaused }),
  logsAutoScroll: true,
  setLogsAutoScroll: (logsAutoScroll) => set({ logsAutoScroll }),
}))
