/** Live streaming abstraction — SSE with polling fallback. */

export type LiveStreamEvent =
  | { type: 'observability'; range: string }
  | { type: 'logs' }
  | { type: 'alerts' }
  | { type: 'heartbeat'; ts: number }

export type LiveStreamListener = (event: LiveStreamEvent) => void

export interface LiveStreamOptions {
  pollIntervalMs?: number
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
  /** Per-event-type throttle so logs/observability/alerts don't cancel each other. */
  private lastEmitByType = new Map<string, number>()
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
    const interval = this.options.pollIntervalMs ?? 12_000
    this.emitAll()
    this.pollTimer = setInterval(() => this.emitAll(), interval)
  }

  private emitAll() {
    this.emit({ type: 'observability', range: '1h' })
    this.emit({ type: 'logs' })
    this.emit({ type: 'alerts' })
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) return
    const delay = Math.min(60_000, 5_000 * 2 ** Math.min(this.reconnectAttempt, 3))
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.listeners.size > 0) this.trySse()
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
    if (event.type !== 'heartbeat') {
      const last = this.lastEmitByType.get(event.type) ?? 0
      if (now - last < throttle) return
      this.lastEmitByType.set(event.type, now)
    }
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

  isDisposed() {
    return this.disposed
  }

  updateOptions(options: LiveStreamOptions) {
    Object.assign(this.options, options)
  }

  getMode(): 'sse' | 'poll' {
    return this.mode
  }
}

let sharedClient: LiveStreamClient | null = null

export function getLiveStreamClient(options?: LiveStreamOptions): LiveStreamClient {
  if (!sharedClient || sharedClient.isDisposed()) {
    sharedClient = new LiveStreamClient(options)
  } else if (options) {
    sharedClient.updateOptions(options)
  }
  return sharedClient
}

export function resetLiveStreamClient() {
  sharedClient?.disconnect()
  sharedClient = null
}
