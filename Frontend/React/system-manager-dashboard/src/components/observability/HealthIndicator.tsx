import styles from './obs.module.css'

type Status = 'Healthy' | 'Warning' | 'Critical' | 'Unknown'

const dot: Record<Status, string> = {
  Healthy: styles.dotSuccess,
  Warning: styles.dotWarning,
  Critical: styles.dotError,
  Unknown: styles.dotMuted,
}

export default function HealthIndicator({
  status,
  showLabel = false,
}: {
  status: Status
  showLabel?: boolean
}) {
  return (
    <span className={styles.row} aria-label={`Health ${status}`}>
      <span className={`${styles.healthDot} ${dot[status]}`} aria-hidden />
      {showLabel ? <span className={styles.strong}>{status}</span> : null}
    </span>
  )
}
