import type { ApiAppointment, EnrichedAppointment } from "@/lib/api/types";

export const STAFF_REALTIME_EVENT = "medicare:staff-realtime";

export type StaffRealtimeSource =
  | "fcm"
  | "inbox-poll"
  | "manual"
  | "local-mutation";

export type StaffRealtimeDetail = {
  source: StaffRealtimeSource;
  title?: string;
  body?: string;
  category?: string;
  appointmentId?: string;
  /** Instant UI patch — consumers apply without waiting on network. */
  appointment?: ApiAppointment | EnrichedAppointment;
  action?: "upsert" | "remove" | "refresh";
};

export function emitStaffRealtime(detail: StaffRealtimeDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<StaffRealtimeDetail>(STAFF_REALTIME_EVENT, { detail }),
  );
}

export function subscribeStaffRealtime(
  handler: (detail: StaffRealtimeDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<StaffRealtimeDetail>;
    handler(custom.detail ?? { source: "manual" });
  };
  window.addEventListener(STAFF_REALTIME_EVENT, listener);
  return () => window.removeEventListener(STAFF_REALTIME_EVENT, listener);
}

/** Coalesce bursts of realtime events into one callback (same tick / few ms). */
export function subscribeStaffRealtimeCoalesced(
  handler: (details: StaffRealtimeDetail[]) => void,
  waitMs = 50,
): () => void {
  let timer: number | null = null;
  let batch: StaffRealtimeDetail[] = [];

  const flush = () => {
    timer = null;
    const next = batch;
    batch = [];
    if (next.length > 0) handler(next);
  };

  return subscribeStaffRealtime((detail) => {
    batch.push(detail);
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(flush, waitMs);
  });
}
