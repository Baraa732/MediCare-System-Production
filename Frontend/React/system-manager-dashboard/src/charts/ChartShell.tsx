import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { EmptyState, SkeletonLoader } from '../components/ui'
import { useUIStore } from '../store/uiStore'
import { applyChartTheme } from './applyChartTheme'
import styles from './charts.module.css'

export type ChartHeight =
  | 28
  | 80
  | 120
  | 140
  | 160
  | 180
  | 200
  | 220
  | 240
  | 260

const heightClass: Record<ChartHeight, string> = {
  28: styles.h28,
  80: styles.h80,
  120: styles.h120,
  140: styles.h140,
  160: styles.h160,
  180: styles.h180,
  200: styles.h200,
  220: styles.h220,
  240: styles.h240,
  260: styles.h260,
}

interface ChartShellProps {
  option: EChartsOption
  height?: ChartHeight
  loading?: boolean
  empty?: boolean
  emptyTitle?: string
  className?: string
  ariaLabel: string
}

export default function ChartShell({
  option,
  height = 180,
  loading = false,
  empty = false,
  emptyTitle = 'No chart data',
  className,
  ariaLabel,
}: ChartShellProps) {
  const reduced = usePrefersReducedMotion()
  const themeMode = useUIStore((s) => s.themeMode)
  const merged = useMemo(() => {
    const themed = applyChartTheme(option, themeMode)
    if (reduced) {
      return { ...themed, animation: false } as EChartsOption
    }
    return {
      ...themed,
      animation: true,
      animationDuration: 700,
      animationEasing: 'cubicOut',
    } as EChartsOption
  }, [option, reduced, themeMode])

  const shellClass = [
    styles.shell,
    heightClass[height],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (loading) {
    return (
      <div className={shellClass}>
        <SkeletonLoader height="100%" />
      </div>
    )
  }

  if (empty) {
    return (
      <div className={shellClass}>
        <EmptyState title={emptyTitle} hint="Static UI — connect telemetry later." />
      </div>
    )
  }

  return (
    <motion.div
      className={shellClass}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      role="img"
      aria-label={ariaLabel}
    >
      <ReactECharts
        key={themeMode}
        option={merged}
        className={styles.canvas}
        opts={{ renderer: 'canvas' }}
        notMerge
        lazyUpdate
      />
    </motion.div>
  )
}
