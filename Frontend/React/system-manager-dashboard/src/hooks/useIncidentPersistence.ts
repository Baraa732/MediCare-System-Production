import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeIncident,
  assignIncident,
  escalateIncident,
  listPlatformIncidents,
  resolveIncident,
  silenceIncident,
} from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL, LIVE_STALE_TIME } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import type { PlatformIncidentStatus } from '../api/types'

function statusFlags(status: PlatformIncidentStatus) {
  return {
    acknowledged: status === 'acknowledged' || status === 'assigned' || status === 'escalated' || status === 'resolved',
    resolved: status === 'resolved',
    escalated: status === 'escalated',
  }
}

export function useIncidentPersistence() {
  const queryClient = useQueryClient()
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const token = resolveSessionToken(storeToken)

  const query = useQuery({
    queryKey: queryKeys.platformIncidents(),
    queryFn: () => listPlatformIncidents(token!),
    enabled: (hasHydrated || Boolean(token)) && Boolean(token),
    staleTime: LIVE_STALE_TIME,
    refetchInterval: LIVE_POLL.incidents,
  })

  const byId = new Map((query.data ?? []).map((row) => [row.id, row]))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.platformIncidents() })

  const meta = (incident: { id: string; title: string; service: string }) => ({
    title: incident.title,
    service: incident.service,
  })

  const ackMutation = useMutation({
    mutationFn: (incident: { id: string; title: string; service: string }) =>
      acknowledgeIncident(token!, incident.id, meta(incident)),
    onSuccess: invalidate,
  })

  const assignMutation = useMutation({
    mutationFn: (payload: { id: string; title: string; service: string; assignee: string }) =>
      assignIncident(token!, payload.id, payload.assignee, meta(payload)),
    onSuccess: invalidate,
  })

  const resolveMutation = useMutation({
    mutationFn: (payload: { id: string; title: string; service: string; notes?: string }) =>
      resolveIncident(token!, payload.id, payload.notes, meta(payload)),
    onSuccess: invalidate,
  })

  const escalateMutation = useMutation({
    mutationFn: (payload: { id: string; title: string; service: string; notes?: string }) =>
      escalateIncident(token!, payload.id, payload.notes, meta(payload)),
    onSuccess: invalidate,
  })

  const silenceMutation = useMutation({
    mutationFn: (payload: { id: string; title: string; service: string; hours: number }) =>
      silenceIncident(token!, payload.id, payload.hours, meta(payload)),
    onSuccess: invalidate,
  })

  const getRecord = useCallback((id: string) => byId.get(id) ?? null, [byId])

  const isAcknowledged = useCallback((id: string) => {
    const row = byId.get(id)
    return row ? statusFlags(row.status).acknowledged : false
  }, [byId])

  const isResolved = useCallback((id: string) => {
    const row = byId.get(id)
    return row ? statusFlags(row.status).resolved : false
  }, [byId])

  const isEscalated = useCallback((id: string) => {
    const row = byId.get(id)
    return row ? statusFlags(row.status).escalated : false
  }, [byId])

  const getOwner = useCallback((id: string) => byId.get(id)?.assignee ?? null, [byId])

  return {
    records: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? normalizeError(query.error, 'Could not load incident state.') : null,
    getRecord,
    isAcknowledged,
    isResolved,
    isEscalated,
    getOwner,
    acknowledge: ackMutation.mutateAsync,
    assign: assignMutation.mutateAsync,
    resolve: resolveMutation.mutateAsync,
    escalate: escalateMutation.mutateAsync,
    silence: silenceMutation.mutateAsync,
    pending:
      ackMutation.isPending ||
      assignMutation.isPending ||
      resolveMutation.isPending ||
      escalateMutation.isPending ||
      silenceMutation.isPending,
  }
}
