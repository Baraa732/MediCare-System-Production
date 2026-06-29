import { ApiError, type ApiErrorBody } from './types'

// All requests go to the same origin under /api and are proxied to the
// NestJS gateway by the Vite dev server (see vite.config.ts).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
  headers?: Record<string, string>
  signal?: AbortSignal
}

function parseError(data: unknown): ApiErrorBody | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as ApiErrorBody
    if (typeof nested.message === 'string') return nested
  }
  if (typeof record.message === 'string') return { message: record.message }
  return null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {}, signal } = options

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  })

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const parsed = parseError(data)
    throw new ApiError(
      res.status,
      parsed?.message ?? `Request failed (${res.status})`,
      parsed?.code,
      parsed?.suggestion,
    )
  }

  return data as T
}
