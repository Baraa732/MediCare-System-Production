import { HealthBadge } from '../ui'
import styles from './obs.module.css'

export default function QueueCard({
  name,
  messages,
  consumers,
  lag,
  status,
  onClick,
}: {
  name: string
  messages: number
  consumers: number
  lag: number
  status: 'Healthy' | 'Warning' | 'Critical'
  onClick?: () => void
}) {
  return (
    <article
      className={styles.queueCard}
      tabIndex={0}
      role={onClick ? 'button' : undefined}
      aria-label={`Queue ${name}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className={styles.rowBetween}>
        <div className={styles.queueName}>{name}</div>
        <HealthBadge status={status} />
      </div>
      <div className={styles.queueMeta}>
        <span>{messages.toLocaleString()} msgs</span>
        <span>{consumers} consumers</span>
        <span>lag {lag}</span>
      </div>
    </article>
  )
}
