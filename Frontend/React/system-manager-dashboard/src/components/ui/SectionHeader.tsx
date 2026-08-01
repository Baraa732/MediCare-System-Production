import styles from './ui.module.css'

export default function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string
  meta?: string
  action?: React.ReactNode
}) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {meta ? <div className={styles.sectionMeta}>{meta}</div> : null}
      </div>
      {action}
    </div>
  )
}
