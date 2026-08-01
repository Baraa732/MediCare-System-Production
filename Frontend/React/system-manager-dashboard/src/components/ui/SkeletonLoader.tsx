import styles from './ui.module.css'

export default function SkeletonLoader({
  height = 16,
  width = '100%',
  radius = 8,
}: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return (
    <div
      className={styles.skeleton}
      style={{ height, width, borderRadius: radius }}
      aria-hidden
    />
  )
}
