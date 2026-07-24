import type { PlatformLogEntry, PlatformLogLevel } from '../../api/types'

export const LOG_LEVEL_COLORS: Record<PlatformLogLevel, string> = {
  ERROR: '#ef4444',
  WARN: '#f59e0b',
  INFO: '#06b6d4',
  DEBUG: '#8b93a8',
  TRACE: '#4d566b',
}

export const LOG_LEVEL_LABELS: Record<PlatformLogLevel, string> = {
  ERROR: 'Error',
  WARN: 'Warning',
  INFO: 'Info',
  DEBUG: 'Debug',
  TRACE: 'Trace',
}

export const ALL_LOG_LEVELS: PlatformLogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

export const TIME_RANGES = [
  { value: '15m', label: 'Last 15m' },
  { value: '1h', label: 'Last 1h' },
  { value: '6h', label: 'Last 6h' },
  { value: '24h', label: 'Last 24h' },
] as const

export const LOG_PAGE_SIZES = [25, 50, 100, 200] as const

export type LogSortOrder = 'newest' | 'oldest'

export const LOG_SORT_OPTIONS: Array<{ value: LogSortOrder; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

export type LogViewDensity = 'comfortable' | 'compact'

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function isJsonLike(value: string): boolean {
  return tryParseJson(value) !== null
}

export interface LogJsonDocument {
  formatted: string
  isNativeJson: boolean
  preview: string
}

export function buildLogJsonDocument(entry: PlatformLogEntry): LogJsonDocument {
  for (const candidate of [entry.message, entry.raw]) {
    const parsed = tryParseJson(candidate)
    if (parsed !== null) {
      const formatted = JSON.stringify(parsed, null, 2)
      return {
        formatted,
        isNativeJson: true,
        preview: summarizeJsonPreview(parsed),
      }
    }
  }

  const document: Record<string, unknown> = {
    id: entry.id,
    timestamp: entry.timestamp,
    level: entry.level,
    service: entry.service,
    message: tryParseJson(entry.message) ?? entry.message,
  }

  if (entry.traceId) document.traceId = entry.traceId
  if (entry.spanId) document.spanId = entry.spanId
  if (entry.requestId) document.requestId = entry.requestId
  if (entry.raw) document.raw = tryParseJson(entry.raw) ?? entry.raw

  const formatted = JSON.stringify(document, null, 2)
  return {
    formatted,
    isNativeJson: false,
    preview: summarizeJsonPreview(document),
  }
}

function summarizeJsonPreview(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value.length > 72 ? `${value.slice(0, 72)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    if (!keys.length) return '{}'
    const preview = keys.slice(0, 4).join(', ')
    return keys.length > 4 ? `{ ${preview}, … }` : `{ ${preview} }`
  }
  return String(value)
}

const RANGE_SECONDS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
}

export function filterEntriesByServices(
  entries: PlatformLogEntry[],
  services?: string[],
): PlatformLogEntry[] {
  if (!services?.length) return entries
  const allowed = new Set(services)
  return entries.filter((entry) => allowed.has(entry.service))
}

export function filterEntriesBySearch(
  entries: PlatformLogEntry[],
  query?: string,
): PlatformLogEntry[] {
  const needle = query?.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter(
    (entry) =>
      entry.message.toLowerCase().includes(needle) ||
      entry.service.toLowerCase().includes(needle) ||
      entry.raw?.toLowerCase().includes(needle) ||
      (entry.traceId ?? '').toLowerCase().includes(needle) ||
      (entry.requestId ?? '').toLowerCase().includes(needle),
  )
}

export function applyLogFilters(
  entries: PlatformLogEntry[],
  filters: {
    services?: string[]
    levels?: PlatformLogLevel[]
    search?: string
  },
): PlatformLogEntry[] {
  let list = entries
  list = filterEntriesByServices(list, filters.services)
  list = filterEntriesBySearch(list, filters.search)
  list = filterEntriesByLevels(list, filters.levels)
  return list
}

export function filterEntriesByLevels(
  entries: PlatformLogEntry[],
  levels?: PlatformLogLevel[],
): PlatformLogEntry[] {
  if (!levels?.length) return entries
  const allowed = new Set(levels)
  return entries.filter((entry) => allowed.has(entry.level))
}

export function countServicesFromEntries(
  entries: PlatformLogEntry[],
  knownServices: string[] = [],
): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const name of knownServices) map.set(name, 0)
  for (const entry of entries) {
    map.set(entry.service, (map.get(entry.service) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function countLevelsFromEntries(
  entries: PlatformLogEntry[],
): Array<{ level: PlatformLogLevel; count: number }> {
  return ALL_LOG_LEVELS.map((level) => ({
    level,
    count: entries.filter((entry) => entry.level === level).length,
  }))
}

export function buildHistogramFromEntries(
  entries: PlatformLogEntry[],
  range = '1h',
): Array<{
  bucket: string
  error: number
  warn: number
  info: number
  debug: number
  trace: number
}> {
  const rangeSeconds = RANGE_SECONDS[range] ?? RANGE_SECONDS['1h']
  const bucketCount = rangeSeconds <= 3600 ? 60 : 48
  const bucketMs = (rangeSeconds * 1000) / bucketCount
  const now = Date.now()
  const start = now - rangeSeconds * 1000

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = start + i * bucketMs
    return {
      bucket: new Date(bucketStart).toISOString(),
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
    }
  })

  for (const entry of entries) {
    const ts = new Date(entry.timestamp).getTime()
    if (Number.isNaN(ts) || ts < start || ts > now) continue
    const index = Math.min(bucketCount - 1, Math.floor((ts - start) / bucketMs))
    const bucket = buckets[index]
    if (entry.level === 'ERROR') bucket.error += 1
    else if (entry.level === 'WARN') bucket.warn += 1
    else if (entry.level === 'DEBUG') bucket.debug += 1
    else if (entry.level === 'TRACE') bucket.trace += 1
    else bucket.info += 1
  }

  return buckets
}

export function sortLogEntries(entries: PlatformLogEntry[], order: LogSortOrder): PlatformLogEntry[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  return order === 'oldest' ? sorted.reverse() : sorted
}

export function formatCount(value: number): string {
  return value.toLocaleString()
}

export function formatLogTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatFriendlyTimestamp(iso: string): {
  relative: string
  absolute: string
  dayLabel: string
} {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return { relative: iso, absolute: iso, dayLabel: 'Unknown' }
  }

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  let relative = 'just now'
  if (diffSec >= 86400) relative = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  else if (diffSec >= 3600) relative = `${diffHour}h ago`
  else if (diffSec >= 60) relative = `${diffMin}m ago`
  else if (diffSec >= 10) relative = `${diffSec}s ago`

  const absolute = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })

  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const dayLabel = isToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return { relative, absolute, dayLabel }
}

export function displayLogMessage(entry: PlatformLogEntry): { title: string; hint: string | null } {
  const table = getTableLogDisplay(entry)
  return { title: table.headline, hint: table.subtitle }
}

export interface TableLogDisplay {
  headline: string
  subtitle: string | null
}

function truncateText(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

function extractFriendlyFromJson(raw: string): string | null {
  const parsed = tryParseJson(raw)
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  for (const key of ['message', 'msg', 'error', 'detail', 'description', 'reason']) {
    const val = obj[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return null
}

/** Short, readable summary for the logs table — never dumps raw JSON blobs. */
export function getTableLogDisplay(entry: PlatformLogEntry): TableLogDisplay {
  const humanized = humanizeLogMessage(entry)
  const raw = (entry.message || entry.raw || '').trim()
  const fromJson = extractFriendlyFromJson(raw)

  // Prefer a readable title; keep enough of the real message so long errors remain useful.
  // CSS line-clamping handles overflow — avoid aggressive truncation here.
  const headline = truncateText(humanized.title || entry.service, 220)

  let subtitle: string | null = null
  if (fromJson && !fromJson.toLowerCase().includes(headline.toLowerCase())) {
    subtitle = truncateText(fromJson, 320)
  } else if (humanized.subtitle && humanized.subtitle !== humanized.title) {
    const clean = isJsonLike(humanized.subtitle)
      ? summarizeJsonPreview(tryParseJson(humanized.subtitle) ?? humanized.subtitle)
      : humanized.subtitle
    if (!clean.toLowerCase().includes(headline.toLowerCase())) {
      subtitle = truncateText(clean, 320)
    }
  }

  // For errors, surface the full message as headline when humanize collapsed it.
  if (entry.level === 'ERROR' && humanized.title === 'Error reported' && raw) {
    return {
      headline: truncateText(raw, 320),
      subtitle: null,
    }
  }
  if (entry.level === 'ERROR' && humanized.title === 'Messaging pipeline signal' && raw) {
    return {
      headline: truncateText(raw, 320),
      subtitle: null,
    }
  }

  return { headline, subtitle }
}

export function humanizeLogMessage(entry: PlatformLogEntry): { title: string; subtitle: string } {
  const msg = entry.message.trim()
  const lower = msg.toLowerCase()

  if (lower.includes('econnrefused') || lower.includes('connection refused')) {
    return { title: 'Connection refused', subtitle: 'A downstream service could not be reached.' }
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { title: 'Request timed out', subtitle: msg }
  }
  if (lower.includes('unauthorized') || lower.includes('401')) {
    return { title: 'Authentication failed', subtitle: msg }
  }
  if (lower.includes('forbidden') || lower.includes('403')) {
    return { title: 'Access denied', subtitle: msg }
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return { title: 'Resource not found', subtitle: msg }
  }
  if (lower.includes('validation') || lower.includes('invalid')) {
    return { title: 'Validation issue', subtitle: msg }
  }
  if (lower.includes('database') || lower.includes('query failed') || lower.includes('typeorm')) {
    return { title: 'Database operation issue', subtitle: msg }
  }
  if (lower.includes('kafka') || lower.includes('broker')) {
    return { title: 'Messaging pipeline signal', subtitle: msg }
  }
  if (lower.includes('health') || lower.includes('ready') || lower.includes('started')) {
    return { title: 'Service lifecycle event', subtitle: msg }
  }
  if (entry.level === 'ERROR') {
    return { title: 'Error reported', subtitle: msg }
  }
  if (entry.level === 'WARN') {
    return { title: 'Warning signal', subtitle: msg }
  }

  const firstSentence = msg.split(/[.!?](?:\s|$)/)[0]?.trim() || msg
  const title = firstSentence.length > 72 ? `${firstSentence.slice(0, 72)}…` : firstSentence
  return { title, subtitle: msg.length > title.length ? msg : entry.service }
}

export function getLogGroupLabel(iso: string): string {
  const { dayLabel, absolute } = formatFriendlyTimestamp(iso)
  return `${dayLabel} · ${absolute}`
}

export interface LogTimeGroup {
  key: string
  label: string
  entries: PlatformLogEntry[]
}

export function groupLogsByTimeWindow(entries: PlatformLogEntry[], windowMinutes = 5): LogTimeGroup[] {
  if (!entries.length) return []

  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const groups: LogTimeGroup[] = []
  let current: LogTimeGroup | null = null
  const windowMs = windowMinutes * 60 * 1000

  for (const entry of sorted) {
    const ts = new Date(entry.timestamp).getTime()
    if (!current) {
      current = { key: String(ts), label: getLogGroupLabel(entry.timestamp), entries: [entry] }
      groups.push(current)
      continue
    }

    const anchor = new Date(current.entries[0].timestamp).getTime()
    if (Math.abs(anchor - ts) <= windowMs) {
      current.entries.push(entry)
    } else {
      current = { key: String(ts), label: getLogGroupLabel(entry.timestamp), entries: [entry] }
      groups.push(current)
    }
  }

  return groups
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    total: items.length,
    start: items.length ? start + 1 : 0,
    end: Math.min(start + pageSize, items.length),
  }
}
