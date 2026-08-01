import StatusPill from './StatusPill'
import styles from './obs.module.css'

export default function AuditCard({
  actor,
  action,
  target,
  ago,
  result,
}: {
  actor: string
  action: string
  target: string
  ago: string
  result: string
}) {
  const tone =
    result === 'Blocked' ? 'error' : result === 'Success' || result === 'Allowed' ? 'success' : 'info'

  return (
    <article className={styles.auditCard} tabIndex={0} aria-label={`${action} by ${actor}`}>
      <div className={styles.rowBetween}>
        <span className={styles.auditActor}>{actor}</span>
        <StatusPill tone={tone}>{result}</StatusPill>
      </div>
      <div className={styles.strong}>{action}</div>
      <div className={styles.muted}>
        {target} · {ago}
      </div>
    </article>
  )
}
