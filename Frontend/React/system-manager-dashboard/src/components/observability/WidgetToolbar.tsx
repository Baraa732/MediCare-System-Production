import styles from './obs.module.css'

export default function WidgetToolbar({
  left,
  right,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className={styles.toolbar}>
      <div>{left}</div>
      <div className={styles.toolbarActions}>{right}</div>
    </div>
  )
}
