import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  KeyRound,
  Server,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AnimatedButton,
  DateSelector,
  SectionHeader,
} from '../../components/ui'
import { MetricCard, LiveIndicator } from '../../components/observability'
import { staggerContainer } from '../../animations/variants'
import { CC_CHART } from '../../charts'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { usePlatformHealth } from '../../hooks/usePlatformHealth'
import { usePlatformStats } from '../../hooks/usePlatformStats'
import { usePlatformLogs } from '../../hooks/usePlatformLogs'
import { useIncidentPersistence } from '../../hooks/useIncidentPersistence'
import { useSecuritySummary } from '../../hooks/useSecuritySummary'
import { useQueueOverview } from '../../hooks/useQueueOverview'
import { useDeployments } from '../../hooks/useDeployments'
import { usePlatformData } from '../../hooks/usePlatformData'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import {
  timeRangeLabel,
  useDashboardStore,
  normalizeTimeRange,
} from '../../store/dashboardStore'
import {
  buildActiveAlerts,
  buildAiInsights,
  buildIncidentTimeline,
  buildOverviewKpis,
  buildServiceRows,
  buildSystemLoad,
} from './overviewModel'
import {
  ActiveAlertsWidget,
  AiInsightsWidget,
  AuditTimelineWidget,
  DatabaseOverviewWidget,
  DeploymentHistoryWidget,
  DistributedTracingWidget,
  ErrorRateWidget,
  IncidentTimelineWidget,
  InfrastructureMapWidget,
  LiveSystemLoadWidget,
  NetworkTrafficWidget,
  PlatformActivityWidget,
  QueueOverviewWidget,
  RecentDeploymentsWidget,
  RecentEventsWidget,
  ResourceUsageWidget,
  SecurityOverviewWidget,
  SystemOverviewWidget,
  TopServicesWidget,
} from '../../widgets'
import styles from './overview.module.css'

const kpiIcons = {
  services: Server,
  healthy: CheckCircle2,
  alerts: AlertTriangle,
  uptime: Gauge,
  requests: Zap,
  latency: Clock3,
  errors: Activity,
} as const

const kpiColors: Record<string, string> = {
  services: CC_CHART.cyan,
  healthy: CC_CHART.green,
  alerts: CC_CHART.red,
  uptime: CC_CHART.green,
  requests: CC_CHART.purple,
  latency: CC_CHART.amber,
  errors: CC_CHART.orange,
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const timeRange = useDashboardStore((s) => s.timeRange)
  const setTimeRange = useDashboardStore((s) => s.setTimeRange)
  const { live, lastSyncAt, mode } = useDashboardLive(true)

  const obs = useObservabilityData(undefined, live)
  const healthQ = usePlatformHealth(live)
  const statsQ = usePlatformStats(live)
  const logsQ = usePlatformLogs({ range: timeRange, limit: 200 }, true, live)
  const { records: incidents } = useIncidentPersistence()
  const securityQ = useSecuritySummary(undefined, live)
  const queuesQ = useQueueOverview(live)
  const deploymentsQ = useDeployments(live)
  const { clinics } = usePlatformData({ loadStaff: false, live: false })

  const kpis = useMemo(
    () =>
      buildOverviewKpis({
        observability: obs.data,
        health: healthQ.health,
        stats: statsQ.stats,
        incidents,
      }),
    [obs.data, healthQ.health, statsQ.stats, incidents],
  )

  const serviceRows = useMemo(() => buildServiceRows(obs.data), [obs.data])
  const load = useMemo(() => buildSystemLoad(obs.data), [obs.data])
  const alerts = useMemo(() => buildActiveAlerts(incidents, obs.data), [incidents, obs.data])
  const timeline = useMemo(
    () => buildIncidentTimeline(incidents, obs.data, queuesQ.data, deploymentsQ.data),
    [incidents, obs.data, queuesQ.data, deploymentsQ.data],
  )
  const insights = useMemo(
    () =>
      buildAiInsights({
        observability: obs.data,
        queues: queuesQ.data,
        security: securityQ.data,
      }),
    [obs.data, queuesQ.data, securityQ.data],
  )

  const syncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString()
    : obs.dataUpdatedAt
      ? new Date(obs.dataUpdatedAt).toLocaleTimeString()
      : '—'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Control Center Overview</h1>
          <p className={styles.heroMeta}>
            Live MediCare observability · synced {syncLabel} · {mode}
          </p>
        </div>
        <div className={styles.heroActions}>
          <LiveIndicator />
          <DateSelector
            value={timeRangeLabel(timeRange)}
            onChange={(v) => setTimeRange(normalizeTimeRange(v))}
          />
          <AnimatedButton onClick={() => navigate('/activation-codes')}>
            <KeyRound size={14} style={{ marginRight: 6 }} />
            Activation Codes
          </AnimatedButton>
          <AnimatedButton
            onClick={() => {
              void obs.refresh()
              void healthQ.refresh()
              void securityQ.refresh()
              void queuesQ.refresh()
              void deploymentsQ.refresh()
              void logsQ.refresh()
            }}
          >
            Refresh
          </AnimatedButton>
        </div>
      </header>

      <SectionHeader
        title="Key performance indicators"
        meta={obs.loading ? 'Loading telemetry…' : 'Live APM · health · incidents'}
      />

      <motion.div
        className={styles.kpiRow}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {kpis.map((kpi, i) => (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={kpiIcons[kpi.id as keyof typeof kpiIcons] ?? Server}
            trend={kpi.trend}
            trendLabel={kpi.trendLabel}
            sparkline={kpi.sparkline}
            live={kpi.live}
            decimals={kpi.decimals ?? 0}
            suffix={kpi.suffix ?? ''}
            delay={i * 0.04}
            sparkColor={kpiColors[kpi.id]}
          />
        ))}
      </motion.div>

      <SectionHeader title="Operations grid" meta="Wired to platform APIs" />

      <div className={styles.grid}>
        <div className={styles.span12}>
          <SystemOverviewWidget delay={0.05} rows={serviceRows} loading={obs.loading} />
        </div>

        <div className={styles.span6}>
          <LiveSystemLoadWidget delay={0.08} load={load} />
        </div>
        <div className={styles.span6}>
          <ActiveAlertsWidget delay={0.11} alerts={alerts} />
        </div>

        <div className={styles.span12}>
          <InfrastructureMapWidget delay={0.14} clinics={clinics} />
        </div>

        <div className={styles.span12}>
          <ErrorRateWidget delay={0.16} observability={obs.data} />
        </div>

        <div className={styles.span6}>
          <ResourceUsageWidget delay={0.18} observability={obs.data} />
        </div>
        <div className={styles.span6}>
          <TopServicesWidget delay={0.2} observability={obs.data} />
        </div>

        <div className={styles.span12}>
          <DistributedTracingWidget delay={0.22} observability={obs.data} />
        </div>

        <div className={styles.span12}>
          <SecurityOverviewWidget delay={0.24} security={securityQ.data} />
        </div>

        <div className={styles.span6}>
          <QueueOverviewWidget delay={0.26} queues={queuesQ.data} />
        </div>
        <div className={styles.span6}>
          <DatabaseOverviewWidget delay={0.28} health={healthQ.health} />
        </div>

        <div className={styles.span12}>
          <PlatformActivityWidget delay={0.3} security={securityQ.data} />
        </div>

        <div className={styles.span12}>
          <AuditTimelineWidget delay={0.32} security={securityQ.data} />
        </div>

        <div className={styles.span6}>
          <RecentDeploymentsWidget delay={0.34} deployments={deploymentsQ.data} />
        </div>
        <div className={styles.span6}>
          <DeploymentHistoryWidget delay={0.36} deployments={deploymentsQ.data} />
        </div>

        <div className={styles.span4}>
          <RecentEventsWidget delay={0.38} incidents={incidents} logs={logsQ.data} />
        </div>
        <div className={styles.span4}>
          <NetworkTrafficWidget delay={0.4} observability={obs.data} />
        </div>
        <div className={styles.span4}>
          <AiInsightsWidget delay={0.42} insights={insights} />
        </div>

        <div className={styles.span12}>
          <IncidentTimelineWidget delay={0.44} items={timeline} />
        </div>
      </div>
    </div>
  )
}
