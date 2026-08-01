import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import styles from './ui.module.css'

export default function TopbarAction({
  children,
  badge,
  label,
  onClick,
  ring = false,
}: {
  children: React.ReactNode
  badge?: string | number
  label: string
  onClick?: () => void
  ring?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const shouldRing = ring && !reduced && badge != null && Number(badge) > 0

  return (
    <motion.button
      type="button"
      className={styles.topbarAction}
      aria-label={label}
      onClick={onClick}
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      animate={shouldRing ? { rotate: [0, -10, 10, -6, 6, 0] } : undefined}
      transition={
        shouldRing
          ? { duration: 0.7, repeat: Infinity, repeatDelay: 4.5, ease: 'easeInOut' }
          : undefined
      }
    >
      {children}
      {badge != null && badge !== '' ? (
        <span className={styles.topbarBadge}>{badge}</span>
      ) : null}
    </motion.button>
  )
}
