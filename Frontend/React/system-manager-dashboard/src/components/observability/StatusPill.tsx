import type { HealthTone } from '../../types/dashboard'
import styles from './obs.module.css'

const toneMap: Record<HealthTone, string> = {
  success: styles.pillSuccess,
  warning: styles.pillWarning,
  error: styles.pillError,
  info: styles.pillInfo,
  muted: styles.pillMuted,
}

export default function StatusPill({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: HealthTone
}) {
  return <span className={`${styles.pill} ${toneMap[tone]}`}>{children}</span>
}
