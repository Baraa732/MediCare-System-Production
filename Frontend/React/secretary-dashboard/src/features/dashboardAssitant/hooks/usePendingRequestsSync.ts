import { useEffect, useRef } from "react";
import { listAppointments } from "@/lib/api/appointments";
import { mapApiAppointmentToPendingRequest } from "@/lib/api/mappers";
import { normalizeCaughtError } from "@/lib/api/errors";
import { subscribeStaffRealtimeCoalesced } from "@/lib/realtimeEvents";
import { useAuthStore } from "@/stores/authStore";
import { usePendingRequest } from "./usePendingRequest";

export function usePendingRequestsSync(clinicId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setRequests = usePendingRequest((s) => s.setRequests);
  const onRemovePendingRequest = usePendingRequest((s) => s.onRemovePendingRequest);
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!accessToken || !clinicId) {
      setRequests([]);
      return;
    }

    let cancelled = false;

    async function loadPendingRequests() {
      if (inFlight.current) return inFlight.current;
      inFlight.current = (async () => {
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
              normalizeCaughtError(
                err,
                "Could not load pending appointment requests.",
              ),
            );
          }
        } finally {
          inFlight.current = null;
        }
      })();
      return inFlight.current;
    }

    void loadPendingRequests();

    // Instant patch from realtime snapshots; soft network confirm after.
    const unsubscribe = subscribeStaffRealtimeCoalesced((batch) => {
      for (const detail of batch) {
        if (detail.appointment) {
          if (detail.appointment.status === "REQUESTED") {
            const mapped = mapApiAppointmentToPendingRequest(detail.appointment);
            const current = usePendingRequest.getState().requests;
            const others = current.filter((r) => r.id !== mapped.id);
            setRequests([mapped, ...others]);
          } else {
            onRemovePendingRequest(detail.appointment.id);
          }
        } else if (detail.action === "remove" && detail.appointmentId) {
          onRemovePendingRequest(detail.appointmentId);
        }
      }
      void loadPendingRequests();
    }, 40);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadPendingRequests();
      }
    }, 25_000);

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
  }, [accessToken, clinicId, setRequests, onRemovePendingRequest]);
}
