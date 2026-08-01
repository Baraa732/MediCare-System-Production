import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { KpiCardProps } from '../../types/dashboard'
import { fadeSlideUp } from '../../animations/variants'
import AnimatedCounter from './AnimatedCounter'
import styles from './ui.module.css'

export default function KpiCard({
  label,
  value,
  icon: Icon,
  trendLabel,
  trend = 'flat',
  live,
  delay = 0,
}: KpiCardProps) {
  const TrendIcon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  const trendClass =
    trend === 'up'
      ? styles.trendUp
      : trend === 'down'
        ? styles.trendDown
        : styles.trendFlat

  return (
    <motion.div
      className={styles.kpi}
      variants={fadeSlideUp}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      whileHover={{ y: -2 }}
    >
      <div className={styles.kpiInner}>
        <div className={styles.kpiTop}>
          <span className={styles.kpiLabel}>{label}</span>
          <div className={styles.kpiIcon}>
            <Icon size={16} strokeWidth={2} />
          </div>
        </div>
        <div className={styles.kpiValue}>
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} />
          ) : (
            value
          )}
        </div>
        <div className={styles.kpiMeta}>
          <span className={trendClass}>
            <TrendIcon size={12} style={{ display: 'inline', verticalAlign: -1 }} />{' '}
            {trendLabel ?? '—'}
          </span>
          {live ? (
            <span className={styles.badge + ' ' + styles.badgeSuccess}>
              <span className={styles.liveDot} /> Live
            </span>
          ) : null}
        </div>
        <div className={styles.sparkSlot} aria-hidden />
      </div>
    </motion.div>
  )
}
