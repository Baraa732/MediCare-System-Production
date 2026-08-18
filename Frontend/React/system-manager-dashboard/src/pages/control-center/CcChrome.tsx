import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AnimatedButton,
  DateSelector,
  SectionHeader,
} from '../../components/ui'
import { LiveIndicator, MetricCard } from '../../components/observability'
import { staggerContainer } from '../../animations/variants'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import {
  timeRangeLabel,
  useDashboardStore,
  normalizeTimeRange,
} from '../../store/dashboardStore'
import type { TrendDirection } from '../../types/dashboard'
import styles from './cc.module.css'

export type CcKpi = {
  id: string
  label: string
  value: number
  icon: LucideIcon
  color: string
  trend: TrendDirection
  trendLabel: string
  decimals?: number
  suffix?: string
}

export function CcPage({
  title,
  description,
  loading,
  onRefresh,
  kpis,
  sectionTitle,
  sectionMeta,
  children,
}: {
  title: string
  description: string
  loading?: boolean
  onRefresh: () => void
  kpis: CcKpi[]
  sectionTitle: string
  sectionMeta?: string
  children: ReactNode
}) {
  const timeRange = useDashboardStore((s) => s.timeRange)
  const setTimeRange = useDashboardStore((s) => s.setTimeRange)
  const { lastSyncAt, mode } = useDashboardLive(true)
  const syncLabel = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : '—'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroMeta}>
            {description} · synced {syncLabel} · {mode}
          </p>
        </div>
        <div className={styles.heroActions}>
          <LiveIndicator />
          <DateSelector
            value={timeRangeLabel(timeRange)}
            onChange={(v) => setTimeRange(normalizeTimeRange(v))}
          />
          <AnimatedButton onClick={onRefresh}>Refresh</AnimatedButton>
        </div>
      </header>

      <SectionHeader
        title={sectionTitle}
        meta={loading ? 'Loading live telemetry…' : sectionMeta}
      />

      <motion.div className={styles.kpiRow} variants={staggerContainer} initial="hidden" animate="show">
        {kpis.map((kpi, i) => (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            trend={kpi.trend}
            trendLabel={kpi.trendLabel}
            sparkline={[kpi.value]}
            live
            decimals={kpi.decimals ?? 0}
            suffix={kpi.suffix ?? ''}
            delay={i * 0.04}
            sparkColor={kpi.color}
          />
        ))}
      </motion.div>

      {children}
    </div>
  )
}

export function CcDrawer({
  title,
  subtitle,
  badge,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  badge?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Close" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label={title}>
        <div className={styles.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            {badge ?? <span />}
            <button type="button" className={styles.ghost} onClick={onClose}>
              Close
            </button>
          </div>
          <div className={styles.drawerTitle}>{title}</div>
          {subtitle ? <div className={styles.drawerSub}>{subtitle}</div> : null}
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </>
  )
}

/** Nest health payloads are sometimes `{ status, latency }` instead of a string. */
export function checkStatusText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    const row = value as { status?: unknown; state?: unknown }
    if (typeof row.status === 'string' && row.status.trim()) return row.status
    if (typeof row.state === 'string' && row.state.trim()) return row.state
  }
  if (value == null) return 'unknown'
  return String(value)
}

export function checkStatusDetail(value: unknown): string {
  if (value && typeof value === 'object') {
    const row = value as { latency?: unknown; message?: unknown }
    if (typeof row.latency === 'string') return row.latency
    if (typeof row.message === 'string') return row.message
  }
  return ''
}

export function healthTone(status: unknown): 'Healthy' | 'Warning' | 'Critical' {
  const value = checkStatusText(status).toLowerCase()
  if (['healthy', 'up', 'ok', 'connected', 'active', 'success', 'ready'].includes(value)) return 'Healthy'
  if (['degraded', 'unknown', 'pending', 'available', 'warning', 'slow', 'not_ready'].includes(value)) return 'Warning'
  return 'Critical'
}
