import { ApiError, type ApiErrorBody } from './types'
import { getActiveSessionToken } from '../lib/sessionToken'

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

function resolveAuthToken(explicit?: string | null): string | null {
  return explicit || getActiveSessionToken()
}

function formatErrorMessage(message: unknown): string | undefined {
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.map(String).join('; ')
  return undefined
}

function parseError(data: unknown): ApiErrorBody | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as Record<string, unknown>
    const msg = formatErrorMessage(nested.message)
    const details = nested.details
    if (Array.isArray(details) && details.length > 0) {
      return {
        message: details.map(String).join('; '),
        code: typeof nested.code === 'string' ? nested.code : undefined,
      }
    }
    if (msg) {
      return {
        message: msg,
        code: typeof nested.code === 'string' ? nested.code : undefined,
      }
    }
  }
  const topMsg = formatErrorMessage(record.message)
  if (topMsg) return { message: topMsg }
  return null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {}, signal } = options
  const authToken = resolveAuthToken(token)

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    cache: 'no-store',
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

export async function apiRequestFormData<T>(
  path: string,
  formData: FormData,
  token?: string | null,
): Promise<T> {
  const authToken = resolveAuthToken(token)
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: formData,
    credentials: 'include',
  })

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
