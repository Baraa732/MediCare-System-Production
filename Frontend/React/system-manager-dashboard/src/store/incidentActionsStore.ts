import { create } from 'zustand'

interface IncidentActionState {
  acknowledged: Set<string>
  assigned: Record<string, string>
  resolved: Set<string>
  escalated: Set<string>
  acknowledge: (id: string) => void
  assign: (id: string, owner: string) => void
  resolve: (id: string) => void
  escalate: (id: string) => void
  isAcknowledged: (id: string) => boolean
  isResolved: (id: string) => boolean
  isEscalated: (id: string) => boolean
  getOwner: (id: string) => string | null
}

export const useIncidentActionsStore = create<IncidentActionState>((set, get) => ({
  acknowledged: new Set(),
  assigned: {},
  resolved: new Set(),
  escalated: new Set(),
  acknowledge: (id) => set((state) => {
    const next = new Set(state.acknowledged)
    next.add(id)
    return { acknowledged: next }
  }),
  assign: (id, owner) => set((state) => ({
    assigned: { ...state.assigned, [id]: owner },
  })),
  resolve: (id) => set((state) => {
    const next = new Set(state.resolved)
    next.add(id)
    return { resolved: next }
  }),
  escalate: (id) => set((state) => {
    const next = new Set(state.escalated)
    next.add(id)
    const ack = new Set(state.acknowledged)
    ack.add(id)
    return { escalated: next, acknowledged: ack }
  }),
  isAcknowledged: (id) => get().acknowledged.has(id),
  isResolved: (id) => get().resolved.has(id),
  isEscalated: (id) => get().escalated.has(id),
  getOwner: (id) => get().assigned[id] ?? null,
}))
