import SeverityBadge from './SeverityBadge'
import styles from './obs.module.css'

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export default function DeploymentCard({
  service,
  version,
  by,
  ago,
  status,
  duration,
}: {
  service: string
  version: string
  by: string
  ago: string
  status: 'Success' | 'Rolled back'
  duration: string
}) {
  return (
    <div className={styles.deployRow}>
      <div className={styles.avatar} aria-hidden>
        {initials(by)}
      </div>
      <div>
        <div className={styles.strong}>
          {service}{' '}
          <span className={styles.muted}>{version}</span>
        </div>
        <div className={styles.muted}>
          by {by} · {duration} · {ago}
        </div>
      </div>
      <SeverityBadge level={status === 'Success' ? 'Success' : 'Warning'} />
    </div>
  )
}
