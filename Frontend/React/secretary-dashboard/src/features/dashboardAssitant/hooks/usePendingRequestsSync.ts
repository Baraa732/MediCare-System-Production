import { useEffect } from "react";
import { listAppointments } from "@/lib/api/appointments";
import { mapApiAppointmentToPendingRequest } from "@/lib/api/mappers";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleContext } from "../context/ScheduleContext";
import { usePendingRequest } from "./usePendingRequest";

export function usePendingRequestsSync() {
  const { clinicId } = useScheduleContext();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setRequests = usePendingRequest((s) => s.setRequests);

  useEffect(() => {
    if (!accessToken || !clinicId) {
      setRequests([]);
      return;
    }

    let cancelled = false;

    async function loadPendingRequests() {
      try {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setDate(to.getDate() + 30);
        to.setHours(23, 59, 59, 999);

        const res = await listAppointments(
          {
            clinicId: clinicId!,
            status: "REQUESTED",
            from: from.toISOString(),
            to: to.toISOString(),
          },
          accessToken!,
        );

        if (cancelled) return;
        setRequests(res.appointments.map(mapApiAppointmentToPendingRequest));
      } catch (err) {
        if (!cancelled) {
          console.warn(
            normalizeCaughtError(err, "Could not load pending appointment requests."),
          );
          setRequests([]);
        }
      }
    }

    void loadPendingRequests();
    const interval = setInterval(() => void loadPendingRequests(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, clinicId, setRequests]);
}
