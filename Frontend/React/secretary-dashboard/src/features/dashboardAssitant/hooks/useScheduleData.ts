import { useCallback, useEffect, useState } from "react";
import { listAppointments } from "@/lib/api/appointments";
import { listDoctors, listMyClinics } from "@/lib/api/clinics";
import { getClinicHours, type ClinicHoursDay } from "@/lib/api/schedule";
import { normalizeCaughtError } from "@/lib/api/errors";
import {
  dayRangeIso,
  mapAppointmentToGrid,
  mapDoctorToGrid,
} from "@/lib/api/mappers";
import { useAuthStore } from "@/stores/authStore";
import { subscribeStaffRealtime } from "@/lib/realtimeEvents";
import type { ApiAppointment } from "@/lib/api/types";
import type { ColumnAppointmentsType } from "../types";
import type { DoctorType } from "../types";

export type DoctorWithAppointments = Omit<DoctorType, "appointments"> & {
  appointments: ColumnAppointmentsType[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  const clinicId =
    resolvedClinicId ??
    (storeClinicId && UUID_RE.test(storeClinicId) ? storeClinicId : undefined);

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
      if (refreshKey === 0) setLoading(true);
      setError(null);

      try {
        const { from, to } = dayRangeIso(selectedDate);
        const [doctorRes, appointmentRes, hoursRes] = await Promise.all([
          listDoctors(clinicId!, accessToken!),
          listAppointments({ clinicId: clinicId!, from, to }, accessToken!),
          getClinicHours(clinicId!, accessToken!).catch(() => ({
            success: false as const,
            hours: [] as ClinicHoursDay[],
          })),
        ]);

        if (cancelled) return;

        const activeAppointments = appointmentRes.appointments.filter(
          (a) => a.status !== "CANCELLED",
        );

        const mappedDoctors = doctorRes.doctors.map((doctor) => {
          const doctorAppointments = activeAppointments
            .filter((a) => a.doctorId === doctor.userId)
            .map((a) => mapAppointmentToGrid(a));

          return {
            ...mapDoctorToGrid(doctor, doctorAppointments.length),
            appointments: doctorAppointments,
          };
        });

        setDoctors(mappedDoctors);
        setAppointments(activeAppointments);
        setClinicHours(hoursRes.hours ?? []);
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

    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, clinicId, selectedDate, refreshKey]);

  useEffect(() => {
    if (!accessToken || !clinicId) return;
    const interval = setInterval(refetch, 15_000);
    const unsubscribe = subscribeStaffRealtime(() => refetch());
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [accessToken, clinicId, refetch]);

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
    refetch,
  };
}
