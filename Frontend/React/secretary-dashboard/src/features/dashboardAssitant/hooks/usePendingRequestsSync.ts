import { useEffect } from "react";
import { listAppointments } from "@/lib/api/appointments";
import { mapApiAppointmentToPendingRequest } from "@/lib/api/mappers";
import { normalizeCaughtError } from "@/lib/api/errors";
import { subscribeStaffRealtime } from "@/lib/realtimeEvents";
import { useAuthStore } from "@/stores/authStore";
import { usePendingRequest } from "./usePendingRequest";

export function usePendingRequestsSync(clinicId?: string) {
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
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setDate(to.getDate() + 60);
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
        }
      }
    }

    void loadPendingRequests();
    const interval = window.setInterval(() => void loadPendingRequests(), 8_000);
    const unsubscribe = subscribeStaffRealtime(() => {
      void loadPendingRequests();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadPendingRequests();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accessToken, clinicId, setRequests]);
}
