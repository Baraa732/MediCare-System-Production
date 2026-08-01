/** Shared real-time polling intervals for the System Manager dashboard (ms). */
export const LIVE_POLL = {
  /** Log stream — most frequently updated. */
  logs: 8_000,
  /** Observability, APM, alerts, traces. */
  observability: 8_000,
  /** Platform KPI stats. */
  stats: 8_000,
  /** Incidents / alert state. */
  incidents: 20_000,
  /** Staff notification inbox. */
  notifications: 20_000,
  /** Clinics/users (heavier payload). */
  platformData: 45_000,
  /** SSE / live-stream fallback when EventSource unavailable. */
  streamFallback: 10_000,
  /** Throttle burst invalidations from SSE (per event type). */
  streamThrottle: 1_000,
} as const

export const LIVE_STALE_TIME = 10_000
