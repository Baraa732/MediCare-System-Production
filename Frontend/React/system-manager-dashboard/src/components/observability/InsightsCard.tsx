import StatusPill from './StatusPill'
import styles from './obs.module.css'

export default function InsightsCard({
  title,
  body,
  confidence,
}: {
  title: string
  body: string
  confidence: number
}) {
  return (
    <article className={styles.insightCard} tabIndex={0} aria-label={`AI insight: ${title}`}>
      <div className={styles.insightTitle}>{title}</div>
      <p className={styles.insightBody}>{body}</p>
      <span className={styles.confidence}>
        <StatusPill tone="info">{confidence}% confidence</StatusPill>
      </span>
    </article>
  )
}
