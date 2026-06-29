import { ApiError } from './types'

const MESSAGE_MAP: Record<string, string> = {
  'Invalid credentials': "The username or password doesn't look right. Please check both and try again.",
  'Authentication failed': 'Your session has expired. Please sign in again.',
  'Invalid or expired token': 'Your session has expired. Please sign in again.',
  'Session has been revoked or expired': 'Your session has expired. Please sign in again.',
  Unauthorized: 'Your session has expired. Please sign in again.',
  'Failed to fetch':
    "We couldn't reach the server. Make sure you're online and the API gateway is running.",
  'Bad gateway — upstream service unreachable':
    "We're having trouble connecting to the server. Please try again in a moment.",
  'Service temporarily unavailable. Please retry in a moment.':
    'The service is temporarily unavailable. Please wait a moment and try again.',
}

export const LOGIN_ERROR_FALLBACK =
  "We couldn't sign you in. Check your username and password, then try again."

export function toUserFriendlyMessage(
  err: ApiError | string,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof err === 'string') return MESSAGE_MAP[err] ?? err

  if (err.status === 401) {
    return MESSAGE_MAP['Invalid credentials'] ?? LOGIN_ERROR_FALLBACK
  }

  if (err.message?.startsWith('Request failed (')) {
    if (err.status === 401) {
      return MESSAGE_MAP['Invalid credentials'] ?? LOGIN_ERROR_FALLBACK
    }
    if (err.status === 502 || err.status === 503) {
      return MESSAGE_MAP['Service temporarily unavailable. Please retry in a moment.'] ?? fallback
    }
  }

  const mapped = MESSAGE_MAP[err.message]
  if (mapped) return mapped
  if (err.message && !err.message.startsWith('Request failed')) return err.message
  return fallback
}

export function toLoginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return toUserFriendlyMessage(err, LOGIN_ERROR_FALLBACK)
  }
  if (err instanceof Error) {
    const mapped = MESSAGE_MAP[err.message]
    if (mapped) return mapped
  }
  return LOGIN_ERROR_FALLBACK
}

export function normalizeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return toUserFriendlyMessage(err, fallback)
  if (err instanceof Error && err.message) {
    return MESSAGE_MAP[err.message] ?? err.message
  }
  return fallback
}
