export const STAFF_REALTIME_EVENT = "medicare:staff-realtime";

export type StaffRealtimeDetail = {
  source: "fcm" | "inbox-poll" | "manual";
  title?: string;
  body?: string;
  category?: string;
  appointmentId?: string;
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
