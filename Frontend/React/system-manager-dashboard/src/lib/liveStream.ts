/** Live streaming abstraction — SSE/WebSocket with polling fallback. */

export type LiveStreamEvent =
  | { type: 'observability'; range: string }
  | { type: 'logs' }
  | { type: 'alerts' }
  | { type: 'heartbeat'; ts: number }

export type LiveStreamListener = (event: LiveStreamEvent) => void

export interface LiveStreamOptions {
  /** Target interval when using polling fallback (ms). */
  pollIntervalMs?: number
  /** Throttle burst events (ms). */
  throttleMs?: number
  getToken?: () => string | null
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class LiveStreamClient {
  private listeners = new Set<LiveStreamListener>()
  private eventSource: EventSource | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastEmit = 0
  private disposed = false
  private mode: 'sse' | 'poll' = 'poll'
  private reconnectAttempt = 0
  private options: LiveStreamOptions

  constructor(options: LiveStreamOptions = {}) {
    this.options = options
  }

  subscribe(listener: LiveStreamListener): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.connect()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.disconnect()
    }
  }

  private connect() {
    if (this.disposed) return
    // Always keep a poll heartbeat so UI updates even if SSE auth fails.
    this.fallbackToPoll()
    this.trySse()
  }

  private trySse() {
    if (this.disposed) return
    const token = this.options.getToken?.()
    if (!token) {
      this.fallbackToPoll()
      return
    }

    // Close previous EventSource without touching the poll timer.
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    const url = `${API_BASE}/system-manager/platform/stream?token=${encodeURIComponent(token)}`

    try {
      this.eventSource = new EventSource(url, { withCredentials: true })
      this.eventSource.onopen = () => {
        this.mode = 'sse'
        this.reconnectAttempt = 0
        // SSE is healthy — poll is still useful as a soft backup; keep it.
        this.startHeartbeat()
      }
      this.eventSource.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as LiveStreamEvent
          this.emit(parsed)
        } catch {
          this.emit({ type: 'observability', range: '1h' })
        }
      }
      this.eventSource.onerror = () => {
        this.eventSource?.close()
        this.eventSource = null
        this.mode = 'poll'
        this.clearHeartbeat()
        this.fallbackToPoll()
        this.scheduleReconnect()
      }
    } catch {
      this.mode = 'poll'
      this.fallbackToPoll()
      this.scheduleReconnect()
    }
  }

  private fallbackToPoll() {
    if (this.disposed || this.pollTimer) return
    this.mode = 'poll'
    const interval = this.options.pollIntervalMs ?? 15_000
    // Emit immediately so the UI refreshes as soon as we fall back.
    this.emit({ type: 'logs' })
    this.emit({ type: 'observability', range: '1h' })
    this.emit({ type: 'alerts' })
    this.pollTimer = setInterval(() => {
      this.emit({ type: 'observability', range: '1h' })
      this.emit({ type: 'logs' })
      this.emit({ type: 'alerts' })
    }, interval)
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) return
    // Back off harder so we do not thrash the gateway with 401s.
    const delay = Math.min(60_000, 5_000 * 2 ** Math.min(this.reconnectAttempt, 3))
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.listeners.size > 0) {
        // Keep poll running while we retry SSE — do NOT clearPoll here.
        this.trySse()
      }
    }, delay)
  }

  private startHeartbeat() {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.emit({ type: 'heartbeat', ts: Date.now() })
    }, 15_000)
  }

  private emit(event: LiveStreamEvent) {
    const throttle = this.options.throttleMs ?? 400
    const now = Date.now()
    if (event.type !== 'heartbeat' && now - this.lastEmit < throttle) return
    if (event.type !== 'heartbeat') this.lastEmit = now
    for (const listener of this.listeners) listener(event)
  }

  private clearPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  disconnect() {
    this.disposed = true
    this.eventSource?.close()
    this.eventSource = null
    this.clearPoll()
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  getMode() {
    return this.mode
  }
}

let sharedClient: LiveStreamClient | null = null

export function getLiveStreamClient(options?: LiveStreamOptions): LiveStreamClient {
  if (!sharedClient || sharedClient['disposed']) {
    sharedClient = new LiveStreamClient(options)
  } else if (options?.getToken) {
    // Refresh token getter on the shared client.
    sharedClient['options'] = { ...sharedClient['options'], ...options }
  }
  return sharedClient
}

export function resetLiveStreamClient() {
  sharedClient?.disconnect()
  sharedClient = null
}
