import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChartShell, gaugeOption, CC_CHART } from '../../charts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import styles from './obs.module.css'

const bars = [
  { key: 'cpu', label: 'CPU', cls: styles.loadCpu },
  { key: 'memory', label: 'RAM', cls: styles.loadRam },
  { key: 'disk', label: 'Disk', cls: styles.loadDisk },
  { key: 'network', label: 'Network', cls: styles.loadNet },
] as const

export default function GaugeCard({
  overall,
  cpu,
  memory,
  disk,
  network,
}: {
  overall: number
  cpu: number
  memory: number
  disk: number
  network: number
}) {
  const reduced = usePrefersReducedMotion()
  const option = useMemo(() => gaugeOption(overall, CC_CHART.cyan), [overall])
  const values = { cpu, memory, disk, network }

  return (
    <div className={styles.gaugeLayout}>
      <ChartShell option={option} height={140} ariaLabel={`System load ${overall} percent`} />
      <div className={styles.loadBars}>
        {bars.map((b) => (
          <div key={b.key} className={styles.loadRow}>
            <span className={styles.muted}>{b.label}</span>
            <div className={styles.loadTrack} aria-hidden>
              <motion.div
                className={`${styles.loadFill} ${b.cls}`}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: values[b.key] / 100 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <span className={styles.loadVal}>{values[b.key]}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
