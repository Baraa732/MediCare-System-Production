import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChartShell, gaugeOption, CC_CHART } from '../../charts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import styles from './obs.module.css'

export type LoadMetric = {
  key: string
  label: string
  value: number | null
  cls: string
}

export default function GaugeCard({
  overall,
  metrics,
}: {
  overall: number
  metrics: LoadMetric[]
}) {
  const reduced = usePrefersReducedMotion()
  const option = useMemo(() => gaugeOption(overall, CC_CHART.cyan), [overall])

  return (
    <div className={styles.gaugeLayout}>
      <ChartShell option={option} height={140} ariaLabel={`System load ${overall} percent`} />
      <div className={styles.loadBars}>
        {metrics.map((b) => (
          <div key={b.key} className={styles.loadRow}>
            <span className={styles.muted}>{b.label}</span>
            <div className={styles.loadTrack} aria-hidden>
              <motion.div
                className={`${styles.loadFill} ${b.cls}`}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: Math.max(0, Math.min(1, (b.value ?? 0) / 100)) }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <span className={styles.loadVal}>{b.value == null ? '—' : `${b.value}%`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
