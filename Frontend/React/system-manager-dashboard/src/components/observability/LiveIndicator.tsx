import styles from './obs.module.css'

export default function LiveIndicator({ label = 'Live' }: { label?: string }) {
  return (
    <span className={styles.live} aria-label={`${label} status`}>
      <span className={styles.livePulse} aria-hidden />
      {label}
    </span>
  )
}
