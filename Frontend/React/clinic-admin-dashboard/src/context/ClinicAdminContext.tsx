import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useAuthStore } from "@/stores/authStore";
import * as clinicApi from "@/lib/api/clinics";
import * as appointmentApi from "@/lib/api/appointments";
import type {
  ApiAppointment,
  ClinicDoctor,
  ClinicPublic,
  StaffMember,
} from "@/lib/api/types";

interface ClinicAdminContextValue {
  clinic: ClinicPublic | null;
  staff: StaffMember[];
  doctors: ClinicDoctor[];
  appointments: ApiAppointment[];
  loading: boolean;
  error: string | null;
  clinicId: string | null;
  reload: () => Promise<void>;
}

const ClinicAdminContext = createContext<ClinicAdminContextValue | null>(null);

export function ClinicAdminProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId);
  const setClinicId = useAuthStore((s) => s.setClinicId);

  const [clinic, setClinic] = useState<ClinicPublic | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(clinicId ?? null);

  const reload = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let resolvedClinicId = clinicId;
      if (!resolvedClinicId) {
        const mine = await clinicApi.getMyClinics(token);
        const clinics = mine.clinics ?? [];
        if (clinics.length === 0) {
          setError("No clinic assigned to this admin account.");
          setLoading(false);
          return;
        }
        resolvedClinicId = clinics[0].id;
        setClinicId(resolvedClinicId);
      }

      const role = useAuthStore.getState().role;
      if (role && role !== "CLINIC_ADMIN") {
        setError("This dashboard is only for clinic administrators.");
        setLoading(false);
        return;
      }

      setActiveClinicId(resolvedClinicId);

      const from = startOfDay(subDays(new Date(), 30)).toISOString();
      const to = endOfDay(new Date()).toISOString();

      const [profileRes, staffRes, doctorsRes, apptRes] = await Promise.all([
        clinicApi.getClinicProfile(resolvedClinicId, token),
        clinicApi.listStaff(resolvedClinicId, token),
        clinicApi.listDoctors(resolvedClinicId, token),
        appointmentApi.listAppointments(
          { clinicId: resolvedClinicId, from, to },
          token,
        ),
      ]);

      setClinic(profileRes.clinic);
      setStaff(staffRes.staff ?? []);
      setDoctors(doctorsRes.doctors ?? []);
      setAppointments(apptRes.appointments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clinic data");
    } finally {
      setLoading(false);
    }
  }, [token, clinicId, setClinicId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      clinic,
      staff,
      doctors,
      appointments,
      loading,
      error,
      clinicId: activeClinicId,
      reload,
    }),
    [clinic, staff, doctors, appointments, loading, error, activeClinicId, reload],
  );

  return (
    <ClinicAdminContext.Provider value={value}>{children}</ClinicAdminContext.Provider>
  );
}

export function useClinicAdmin() {
  const ctx = useContext(ClinicAdminContext);
  if (!ctx) {
    throw new Error("useClinicAdmin must be used within ClinicAdminProvider");
  }
  return ctx;
}
