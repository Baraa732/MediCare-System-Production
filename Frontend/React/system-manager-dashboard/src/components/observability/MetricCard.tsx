import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import type { TrendDirection } from '../../types/dashboard'
import { fadeSlideUp } from '../../animations/variants'
import { AnimatedCounter } from '../ui'
import SparklineCard from './SparklineCard'
import TrendBadge from './TrendBadge'
import LiveIndicator from './LiveIndicator'
import { CC_CHART } from '../../charts'
import styles from '../ui/ui.module.css'

export default function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  sparkline,
  live,
  decimals = 0,
  suffix = '',
  delay = 0,
  sparkColor = CC_CHART.cyan,
}: {
  label: string
  value: number
  icon: LucideIcon
  trend: TrendDirection
  trendLabel: string
  sparkline: readonly number[]
  live?: boolean
  decimals?: number
  suffix?: string
  delay?: number
  sparkColor?: string
}) {
  return (
    <motion.article
      className={styles.kpi}
      variants={fadeSlideUp}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      whileHover={{ y: -2 }}
      aria-label={`${label}: ${value}${suffix}`}
    >
      <div className={styles.kpiInner}>
        <div className={styles.kpiTop}>
          <span className={styles.kpiLabel}>{label}</span>
          <div className={styles.kpiIcon} aria-hidden>
            <Icon size={16} strokeWidth={2} />
          </div>
        </div>
        <div className={styles.kpiValue}>
          <AnimatedCounter value={value} decimals={decimals} suffix={suffix} />
        </div>
        <div className={styles.kpiMeta}>
          <TrendBadge trend={trend} label={trendLabel} />
          {live ? <LiveIndicator /> : null}
        </div>
        <div className={styles.sparkSlotLive}>
          <SparklineCard
            data={[...sparkline]}
            color={sparkColor}
            ariaLabel={`${label} trend`}
          />
        </div>
      </div>
    </motion.article>
  )
}
