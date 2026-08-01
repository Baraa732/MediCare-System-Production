import styles from './obs.module.css'

type Tone = 'success' | 'warning' | 'error' | 'info' | 'muted'

const toneDot: Record<Tone, string> = {
  success: styles.dotSuccess,
  warning: styles.dotWarning,
  error: styles.dotError,
  info: styles.dotInfo,
  muted: styles.dotMuted,
}

export interface TimelineItemData {
  id: string
  title: string
  meta?: string
  ago?: string
  tone?: Tone
  badge?: React.ReactNode
}

export default function TimelineCard({ items }: { items: TimelineItemData[] }) {
  return (
    <ol className={styles.timeline} aria-label="Timeline">
      {items.map((item) => (
        <li key={item.id} className={styles.timelineItem}>
          <div className={styles.timelineRail}>
            <span
              className={`${styles.timelineDot} ${toneDot[item.tone ?? 'info']}`}
              aria-hidden
            />
          </div>
          <div className={styles.timelineBody}>
            <div className={styles.rowBetween}>
              <div className={styles.timelineTitle}>{item.title}</div>
              {item.badge}
            </div>
            <div className={styles.timelineMeta}>
              {item.meta ? <span>{item.meta}</span> : null}
              {item.ago ? <span>{item.ago}</span> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
