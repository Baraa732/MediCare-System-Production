import { motion } from 'framer-motion'
import type { DashboardCardProps } from '../../types/dashboard'
import { fadeSlideUp } from '../../animations/variants'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import styles from './ui.module.css'

export default function DashboardCard({
  children,
  className,
  style,
  delay = 0,
  minHeight,
}: DashboardCardProps) {
  const reduced = usePrefersReducedMotion()
  return (
    <motion.div
      className={[styles.card, className].filter(Boolean).join(' ')}
      style={{ minHeight, ...style }}
      variants={fadeSlideUp}
      initial={reduced ? false : 'hidden'}
      animate="show"
      transition={{ delay: reduced ? 0 : delay }}
      whileHover={reduced ? undefined : { y: -2 }}
    >
      <div className={styles.cardBody} style={{ minHeight }}>
        {children}
      </div>
    </motion.div>
  )
}
