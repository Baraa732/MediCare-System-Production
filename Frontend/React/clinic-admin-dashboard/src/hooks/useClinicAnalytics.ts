import { useCallback, useEffect, useState } from "react";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { listAppointments } from "@/lib/api/appointments";
import type { ApiAppointment } from "@/lib/api/types";
import { useAuthStore } from "@/stores/authStore";

export function useClinicAnalytics(clinicId: string | null, days: number) {
  const token = useAuthStore((s) => s.accessToken);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !clinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const from = startOfDay(subDays(new Date(), days - 1)).toISOString();
      const to = endOfDay(new Date()).toISOString();
      const res = await listAppointments({ clinicId, from, to }, token);
      setAppointments(res.appointments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [token, clinicId, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { appointments, loading, error, reload };
}
