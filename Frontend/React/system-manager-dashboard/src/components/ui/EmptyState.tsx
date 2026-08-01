import styles from './ui.module.css'

export default function EmptyState({
  title = 'No data yet',
  hint = 'Connect observability sources later — UI placeholder only.',
}: {
  title?: string
  hint?: string
}) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyTitle}>{title}</div>
      <div className={styles.emptyHint}>{hint}</div>
    </div>
  )
}
