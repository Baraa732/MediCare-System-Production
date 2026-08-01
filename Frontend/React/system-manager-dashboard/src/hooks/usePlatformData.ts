import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getClinicStaff, listAllUsers, listClinics } from '../api/systemManager'
import { normalizeError } from '../api/errors'
import { queryKeys } from '../lib/queryClient'
import { LIVE_POLL, LIVE_STALE_TIME } from '../lib/livePolling'
import { resolveSessionToken } from '../lib/sessionToken'
import { useAuthStore } from '../store/authStore'
import type { Clinic, ClinicStaffMember, PlatformUser } from '../api/types'

export type ClinicStaffGroup = { clinic: Clinic; staff: ClinicStaffMember[] }

async function fetchPlatformData(token: string, loadStaff: boolean): Promise<{
  clinics: Clinic[]
  users: PlatformUser[]
  staffByClinic: ClinicStaffGroup[]
}> {
  const [clinicsRes, allUsers] = await Promise.all([listClinics(token), listAllUsers(token)])
  const clinicList = clinicsRes.clinics ?? []

  if (!loadStaff) {
    return { clinics: clinicList, users: allUsers, staffByClinic: [] }
  }

  const userMap = new Map(allUsers.map((u) => [u.id, u]))
  const groups = await Promise.all(
    clinicList.map(async (clinic) => {
      const res = await getClinicStaff(token, clinic.id)
      const staff: ClinicStaffMember[] = (res.staff ?? []).map((assignment) => ({
        ...assignment,
        user: userMap.get(assignment.userId),
      }))
      return { clinic, staff }
    }),
  )

  return { clinics: clinicList, users: allUsers, staffByClinic: groups }
}

export function usePlatformData(options?: { loadStaff?: boolean; live?: boolean }) {
  const storeToken = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const token = resolveSessionToken(storeToken)
  const loadStaff = options?.loadStaff ?? false
  const live = options?.live ?? true
  const sessionReady = hasHydrated || Boolean(token)

  const query = useQuery({
    queryKey: [...queryKeys.platformData(), loadStaff ? 'staff' : 'base'],
    queryFn: () => fetchPlatformData(token!, loadStaff),
    enabled: sessionReady && Boolean(token),
    staleTime: LIVE_STALE_TIME,
    refetchInterval: live ? LIVE_POLL.platformData : false,
    retry: 1,
  })

  const reload = useCallback(async () => {
    await query.refetch()
  }, [query])

  return {
    clinics: query.data?.clinics ?? [],
    users: query.data?.users ?? [],
    staffByClinic: query.data?.staffByClinic ?? [],
    loading: !sessionReady || query.isLoading,
    staffLoading: loadStaff && query.isFetching,
    error: query.error ? normalizeError(query.error, 'Could not load platform data.') : null,
    reload,
    token,
  }
}

export function countByRole(users: PlatformUser[]) {
  const counts: Record<string, number> = {}
  for (const u of users) {
    counts[u.role] = (counts[u.role] ?? 0) + 1
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

export function countByStatus<T extends { status: string }>(items: T[]) {
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}
