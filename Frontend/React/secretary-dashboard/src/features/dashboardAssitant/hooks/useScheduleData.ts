import { useCallback, useEffect, useRef, useState } from "react";
import { listAppointments } from "@/lib/api/appointments";
import { listDoctors, listMyClinics } from "@/lib/api/clinics";
import {
  getClinicHours,
  listScheduleBlocks,
  type ClinicHoursDay,
  type ScheduleBlock,
} from "@/lib/api/schedule";
import { normalizeCaughtError } from "@/lib/api/errors";
import {
  dayRangeIso,
  mapAppointmentToGrid,
  mapDoctorToGrid,
} from "@/lib/api/mappers";
import { useAuthStore } from "@/stores/authStore";
import {
  subscribeStaffRealtimeCoalesced,
  type StaffRealtimeDetail,
} from "@/lib/realtimeEvents";
import type { ApiAppointment, ClinicDoctor, EnrichedAppointment } from "@/lib/api/types";
import {
  applyAppointmentSnapshotLocally,
  mergeAppointmentIntoDoctors,
} from "../utils/applyAppointmentLocally";
import type { DoctorWithAppointments } from "../types/DoctorWithAppointments";
import { clinicDateKey } from "@/lib/time/clinicTime";

export type { DoctorWithAppointments };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildDoctors(
  clinicDoctors: ClinicDoctor[],
  appointments: ApiAppointment[],
): DoctorWithAppointments[] {
  const active = appointments.filter((a) => a.status !== "CANCELLED");
  return clinicDoctors.map((doctor) => {
    const doctorAppointments = active
      .filter((a) => a.doctorId === doctor.userId)
      .map((a) => mapAppointmentToGrid(a));
    return {
      ...mapDoctorToGrid(doctor, doctorAppointments.length),
      appointments: doctorAppointments,
    };
  });
}

export function useScheduleData(selectedDate = new Date()) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const storeClinicId = useAuthStore((s) => s.clinicId);
  const setClinicId = useAuthStore((s) => s.setClinicId);
  const [resolvedClinicId, setResolvedClinicId] = useState<string | undefined>(
    storeClinicId && UUID_RE.test(storeClinicId) ? storeClinicId : undefined,
  );
  const [resolvingClinic, setResolvingClinic] = useState(true);
  const [doctors, setDoctors] = useState<DoctorWithAppointments[]>([]);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState<string | undefined>();
  const [clinicHours, setClinicHours] = useState<ClinicHoursDay[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const clinicDoctorsRef = useRef<ClinicDoctor[]>([]);
  const selectedDateRef = useRef(selectedDate);
  const softRefreshInFlight = useRef<Promise<void> | null>(null);
  selectedDateRef.current = selectedDate;

  const clinicId =
    resolvedClinicId ??
    (storeClinicId && UUID_RE.test(storeClinicId) ? storeClinicId : undefined);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  const applyAppointmentLocally = useCallback(
    (appointment: ApiAppointment | EnrichedAppointment) => {
      applyAppointmentSnapshotLocally(appointment, selectedDateRef.current);

      setAppointments((prev) => {
        const without = prev.filter((a) => a.id !== appointment.id);
        if (appointment.status === "CANCELLED") return without;
        if (
          clinicDateKey(appointment.scheduledAt) !==
          clinicDateKey(selectedDateRef.current)
        ) {
          return without;
        }
        return [...without, appointment];
      });

      setDoctors((prev) =>
        mergeAppointmentIntoDoctors(prev, appointment, selectedDateRef.current),
      );
    },
    [],
  );

  /** Appointments-only refresh — skips doctors/hours/blocks for speed. */
  const softRefetch = useCallback(async () => {
    if (!accessToken || !clinicId) return;
    if (softRefreshInFlight.current) return softRefreshInFlight.current;

    softRefreshInFlight.current = (async () => {
      try {
        const { from, to } = dayRangeIso(selectedDateRef.current);
        const appointmentRes = await listAppointments(
          { clinicId, from, to },
          accessToken,
        );
        const active = appointmentRes.appointments.filter(
          (a) => a.status !== "CANCELLED",
        );
        setAppointments(active);
        if (clinicDoctorsRef.current.length > 0) {
          setDoctors(buildDoctors(clinicDoctorsRef.current, active));
        }
      } catch {
        // Soft refresh failures are non-fatal; next poll/realtime retries.
      } finally {
        softRefreshInFlight.current = null;
      }
    })();

    return softRefreshInFlight.current;
  }, [accessToken, clinicId]);

  // Resolve clinic assignment + display name for this secretary
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    async function syncClinicAssignment() {
      setResolvingClinic(true);
      try {
        const res = await listMyClinics(accessToken!, "SECRETARY");
        if (cancelled) return;

        const clinics = res.clinics ?? [];
        const preferred =
          clinics.find((c) => c.id === clinicId) ??
          clinics.find((c) => c.id === storeClinicId) ??
          clinics[0];

        if (preferred?.id && UUID_RE.test(preferred.id)) {
          setResolvedClinicId(preferred.id);
          setClinicId(preferred.id);
          if (preferred.name) {
            setClinicName(preferred.name);
          }
        }
      } catch {
        // handled when schedule load runs
      } finally {
        if (!cancelled) {
          setResolvingClinic(false);
        }
      }
    }

    void syncClinicAssignment();
    return () => {
      cancelled = true;
    };
  }, [accessToken, clinicId, storeClinicId, setClinicId]);

  useEffect(() => {
    if (storeClinicId && UUID_RE.test(storeClinicId)) {
      setResolvedClinicId(storeClinicId);
    }
  }, [storeClinicId]);

  const hasLoadedOnceRef = useRef(false);

  // Full load (first paint / day change / hard refetch)
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      setError("Your session has expired. Please sign in again.");
      return;
    }

    if (!clinicId) {
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!hasLoadedOnceRef.current) setLoading(true);
      setError(null);

      try {
        const { from, to } = dayRangeIso(selectedDate);
        const [doctorRes, appointmentRes, hoursRes, blocksRes] =
          await Promise.all([
            listDoctors(clinicId!, accessToken!),
            listAppointments({ clinicId: clinicId!, from, to }, accessToken!),
            getClinicHours(clinicId!, accessToken!).catch(() => ({
              success: false as const,
              hours: [] as ClinicHoursDay[],
            })),
            listScheduleBlocks(clinicId!, accessToken!).catch(() => ({
              success: false as const,
              blocks: [] as ScheduleBlock[],
            })),
          ]);

        if (cancelled) return;

        clinicDoctorsRef.current = doctorRes.doctors;
        const activeAppointments = appointmentRes.appointments.filter(
          (a) => a.status !== "CANCELLED",
        );

        setDoctors(buildDoctors(doctorRes.doctors, activeAppointments));
        setAppointments(activeAppointments);
        setClinicHours(hoursRes.hours ?? []);
        setScheduleBlocks(
          (blocksRes.blocks ?? []).filter(
            (b) => !b.status || b.status === "APPROVED",
          ),
        );
        hasLoadedOnceRef.current = true;
      } catch (err) {
        if (!cancelled) {
          setError(
            normalizeCaughtError(
              err,
              "Could not load the schedule. Please refresh the page.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, clinicId, selectedDate, refreshKey]);

  // Realtime: apply snapshots instantly, then soft-refresh appointments in background.
  useEffect(() => {
    if (!accessToken || !clinicId) return;

    const unsubscribe = subscribeStaffRealtimeCoalesced(
      (batch: StaffRealtimeDetail[]) => {
        for (const detail of batch) {
          if (detail.appointment) {
            applyAppointmentLocally(detail.appointment);
          } else if (detail.action === "remove" && detail.appointmentId) {
            setAppointments((prev) =>
              prev.filter((a) => a.id !== detail.appointmentId),
            );
            setDoctors((prev) =>
              prev.map((doc) => ({
                ...doc,
                appointments: doc.appointments.filter(
                  (a) => a.id !== detail.appointmentId,
                ),
              })),
            );
          }
        }
        // Confirm with server without blocking UI / flashing loaders.
        void softRefetch();
      },
      40,
    );

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void softRefetch();
      }
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void softRefetch();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accessToken, clinicId, applyAppointmentLocally, softRefetch]);

  useEffect(() => {
    if (!accessToken || clinicId || resolvingClinic) return;
    const timeout = setTimeout(() => {
      setLoading(false);
      setError(
        "Your account is not linked to any clinic. Contact your clinic administrator.",
      );
    }, 8000);
    return () => clearTimeout(timeout);
  }, [accessToken, clinicId, resolvingClinic]);

  return {
    doctors,
    appointments,
    loading,
    error,
    clinicId,
    clinicName,
    clinicHours,
    scheduleBlocks,
    refetch,
    softRefetch,
    applyAppointmentLocally,
  };
}
