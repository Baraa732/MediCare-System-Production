import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  Server,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AnimatedButton,
  DateSelector,
  SectionHeader,
} from '../../components/ui'
import { MetricCard } from '../../components/observability'
import { staggerContainer } from '../../animations/variants'
import { KPI_DATA } from '../../constants/overviewData'
import { CC_CHART } from '../../charts'
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
  SystemLogsWidget,
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
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Control Center Overview</h1>
          <p className={styles.heroMeta}>
            MediCare enterprise observability · static UI architecture · no live telemetry
          </p>
        </div>
        <div className={styles.heroActions}>
          <DateSelector />
          <AnimatedButton>Customize layout</AnimatedButton>
        </div>
      </header>

      <SectionHeader
        title="Key performance indicators"
        meta="Animated counters · sparklines · live badges"
      />

      <motion.div
        className={styles.kpiRow}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {KPI_DATA.map((kpi, i) => (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={kpiIcons[kpi.id]}
            trend={kpi.trend}
            trendLabel={kpi.trendLabel}
            sparkline={kpi.sparkline}
            live={kpi.live}
            decimals={'decimals' in kpi ? kpi.decimals : 0}
            suffix={'suffix' in kpi ? kpi.suffix : ''}
            delay={i * 0.04}
            sparkColor={kpiColors[kpi.id]}
          />
        ))}
      </motion.div>

      <SectionHeader title="Operations grid" meta="Enterprise observability widgets" />

      <div className={styles.grid}>
        <div className={styles.span3}><SystemOverviewWidget delay={0.05} /></div>
        <div className={styles.span3}><InfrastructureMapWidget delay={0.08} /></div>
        <div className={styles.span3}><LiveSystemLoadWidget delay={0.11} /></div>
        <div className={styles.span3}><ActiveAlertsWidget delay={0.14} /></div>

        <div className={styles.span4}><ResourceUsageWidget delay={0.16} /></div>
        <div className={styles.span4}><TopServicesWidget delay={0.18} /></div>
        <div className={styles.span4}><ErrorRateWidget delay={0.2} /></div>

        <div className={styles.span6}><RecentDeploymentsWidget delay={0.22} /></div>
        <div className={styles.span6}><SystemLogsWidget delay={0.24} /></div>

        <div className={styles.span3}><DistributedTracingWidget delay={0.26} /></div>
        <div className={styles.span3}><DatabaseOverviewWidget delay={0.28} /></div>
        <div className={styles.span3}><QueueOverviewWidget delay={0.3} /></div>
        <div className={styles.span3}><SecurityOverviewWidget delay={0.32} /></div>

        <div className={styles.span3}><RecentEventsWidget delay={0.34} /></div>
        <div className={styles.span3}><PlatformActivityWidget delay={0.36} /></div>
        <div className={styles.span3}><NetworkTrafficWidget delay={0.38} /></div>
        <div className={styles.span3}><AiInsightsWidget delay={0.4} /></div>

        <div className={styles.span4}><IncidentTimelineWidget delay={0.42} /></div>
        <div className={styles.span4}><DeploymentHistoryWidget delay={0.44} /></div>
        <div className={styles.span4}><AuditTimelineWidget delay={0.46} /></div>
      </div>
    </div>
  )
}
