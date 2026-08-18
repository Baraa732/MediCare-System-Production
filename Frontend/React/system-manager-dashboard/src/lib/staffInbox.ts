import type { StaffInboxItem } from '../api/notifications'

export type InboxSeverity = 'critical' | 'high' | 'warning' | 'info'
export type InboxThreshold = 'info' | 'warning' | 'error'

export function inboxSeverity(item: StaffInboxItem): InboxSeverity {
  const raw = String(item.data?.severity ?? '').toLowerCase()
  if (raw === 'critical' || raw === 'high' || raw === 'warning' || raw === 'info') return raw
  return 'info'
}

export function inboxKind(item: StaffInboxItem): string {
  const kind = item.data?.kind
  if (typeof kind === 'string' && kind.trim()) return kind.trim().toUpperCase()
  return (item.category || 'SYSTEM').toUpperCase()
}

export function inboxDeepLink(item: StaffInboxItem): string {
  return sanitizeDeepLink(item.data?.deepLink)
}

export function sanitizeDeepLink(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/'
  return trimmed
}

export function severityRank(severity: InboxSeverity): number {
  if (severity === 'critical') return 3
  if (severity === 'high') return 2
  if (severity === 'warning') return 1
  return 0
}

export function thresholdRank(threshold: InboxThreshold): number {
  if (threshold === 'error') return 2
  if (threshold === 'warning') return 1
  return 0
}

export function passesThreshold(item: StaffInboxItem, threshold: InboxThreshold): boolean {
  return severityRank(inboxSeverity(item)) >= thresholdRank(threshold)
}

export function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (!Number.isFinite(mins) || mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function severityTone(severity: InboxSeverity): 'ok' | 'warn' | 'bad' | 'sys' {
  if (severity === 'critical') return 'bad'
  if (severity === 'high' || severity === 'warning') return 'warn'
  return 'sys'
}

export function severityBadge(severity: InboxSeverity): 'Critical' | 'Warning' | 'Info' {
  if (severity === 'critical') return 'Critical'
  if (severity === 'info') return 'Info'
  return 'Warning'
}

export function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    HEALTH: 'Health',
    QUEUE: 'Queue',
    ALERT: 'Alert',
    SECURITY: 'Security',
    ACTIVATION: 'Activation',
    ADMIN: 'Admin',
    BROADCAST: 'Broadcast',
    SYSTEM: 'System',
  }
  return labels[kind] ?? kind.replace(/_/g, ' ').toLowerCase()
}
