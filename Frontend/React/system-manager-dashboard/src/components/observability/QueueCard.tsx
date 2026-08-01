import { HealthBadge } from '../ui'
import styles from './obs.module.css'

export default function QueueCard({
  name,
  messages,
  consumers,
  lag,
  status,
}: {
  name: string
  messages: number
  consumers: number
  lag: number
  status: 'Healthy' | 'Warning' | 'Critical'
}) {
  return (
    <article className={styles.queueCard} tabIndex={0} aria-label={`Queue ${name}`}>
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
