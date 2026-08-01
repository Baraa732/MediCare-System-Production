import type { HealthTone } from '../../types/dashboard'
import styles from './ui.module.css'

const toneClass: Record<HealthTone, string> = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  error: styles.badgeError,
  info: styles.badgeInfo,
  muted: styles.badgeMuted,
}

export function MetricBadge({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: HealthTone
}) {
  return <span className={`${styles.badge} ${toneClass[tone]}`}>{children}</span>
}

export function HealthBadge({
  status,
}: {
  status: 'Healthy' | 'Warning' | 'Critical' | 'Unknown'
}) {
  const tone: HealthTone =
    status === 'Healthy'
      ? 'success'
      : status === 'Warning'
        ? 'warning'
        : status === 'Critical'
          ? 'error'
          : 'muted'
  return <MetricBadge tone={tone}>{status}</MetricBadge>
}

export function StatusBadge({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: HealthTone
}) {
  return <MetricBadge tone={tone}>{children}</MetricBadge>
}

export function AlertBadge({
  level,
}: {
  level: 'Critical' | 'Warning' | 'Info'
}) {
  const tone: HealthTone =
    level === 'Critical' ? 'error' : level === 'Warning' ? 'warning' : 'info'
  return <MetricBadge tone={tone}>{level}</MetricBadge>
}
