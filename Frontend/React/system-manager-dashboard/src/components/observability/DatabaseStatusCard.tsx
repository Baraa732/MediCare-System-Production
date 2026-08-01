import { HealthBadge } from '../ui'
import styles from './obs.module.css'

export default function DatabaseStatusCard({
  name,
  engine,
  health,
  latencyMs,
  storage,
  version,
}: {
  name: string
  engine: string
  health: 'Healthy' | 'Warning' | 'Critical'
  latencyMs: number
  storage: string
  version: string
}) {
  return (
    <article className={styles.dbCard} tabIndex={0} aria-label={name}>
      <div className={styles.rowBetween}>
        <div className={styles.dbName}>{name}</div>
        <HealthBadge status={health} />
      </div>
      <div className={styles.muted}>{engine}</div>
      <div className={styles.dbMeta}>
        <span>{latencyMs}ms</span>
        <span>v{version}</span>
        <span>{storage}</span>
      </div>
    </article>
  )
}
