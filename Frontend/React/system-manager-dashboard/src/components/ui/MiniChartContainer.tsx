import styles from './ui.module.css'

export default function MiniChartContainer({
  label = 'Chart reserved',
  height,
}: {
  label?: string
  height?: number | string
}) {
  return (
    <div className={styles.chartSlot} style={{ minHeight: height ?? 140 }}>
      {label}
    </div>
  )
}
