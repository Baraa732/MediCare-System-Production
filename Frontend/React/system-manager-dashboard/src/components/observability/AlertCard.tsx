import SeverityBadge from './SeverityBadge'
import styles from './obs.module.css'

export default function AlertCard({
  title,
  service,
  level,
  ago,
}: {
  title: string
  service: string
  level: 'Critical' | 'Warning' | 'Info'
  ago: string
}) {
  const bar =
    level === 'Critical'
      ? styles.alertBarCritical
      : level === 'Warning'
        ? styles.alertBarWarning
        : styles.alertBarInfo

  return (
    <article
      className={`${styles.alertCard} ${styles.focusRing}`}
      tabIndex={0}
      aria-label={`${level} alert: ${title}`}
    >
      <div className={bar} aria-hidden />
      <div>
        <div className={styles.alertTitle}>{title}</div>
        <div className={styles.alertMeta}>
          {service} · {ago}
        </div>
      </div>
      <SeverityBadge level={level} />
    </article>
  )
}
