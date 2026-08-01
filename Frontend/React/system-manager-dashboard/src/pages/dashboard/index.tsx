import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, Box, LinearProgress } from '@mui/material'
import { LayoutDashboard } from 'lucide-react'
import { AdvancedPageHeader, ObservabilityPage, PbiGrid } from '../../components/advanced/AdvancedPage'
import LogsPreview from '../../components/dashboard/LogsPreview'
import { AnimatedGridItem } from '../../components/motion/AnimatedGridItem'
import { DashboardEntrance, DASHBOARD_MOTION } from '../../components/motion/DashboardEntrance'
import { PageMotion } from '../../components/motion/PageMotion'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { usePlatformData } from '../../hooks/usePlatformData'
import { usePlatformStats } from '../../hooks/usePlatformStats'
import { useDashboardStore } from '../../store/dashboardStore'
import { invalidateDashboardQueries } from '../../lib/queryClient'
import KpiStrip from './components/KpiStrip'
import type { KpiItem } from './components/KpiStrip'
import AIOpsCommandCenter from './components/AIOpsCommandCenter'
import ExecutiveSummaryCard from './components/ExecutiveSummaryCard'
import AiInsightsPanel from './components/AiInsightsPanel'
import IncidentCommandDrawer from './components/IncidentCommandDrawer'
import DashboardLiveBar from './components/DashboardLiveBar'
import LiveTelemetryRow from './components/LiveTelemetryRow'
import {
  IncidentPanel,
  IntegrationPanel,
  OperationsQueue,
  Panel,
  SectionHeading,
  ServiceHealthMatrix,
  TelemetryPlaceholder,
} from './components/DashboardPanels'
import {
  aggregateSeries,
  buildIncidents,
  computePlatformHealthScore,
  seriesFromReal,
  type DashboardIncident,
} from './dashboardUtils'
import { computeErrorBudget, generateInsights } from './insightsEngine'
import { buildAIOpsSnapshot } from '../../lib/aiopsEngine'

const ActivationFunnelChart = lazy(() => import('./components/ActivationFunnelChart'))
const ClinicGrowthChart = lazy(() => import('./components/ClinicGrowthChart'))
const LatencyHeatmapChart = lazy(() => import('./components/LatencyHeatmapChart'))
const ErrorTreemapChart = lazy(() => import('./components/ErrorTreemapChart'))

function ChartFallback() {
  return <LinearProgress sx={{ my: 2 }} />
}

/** Command Center — KPIs, telemetry charts, and operational panels. */
export default function Dashboard() {
  const location = useLocation()
  const timeRange = useDashboardStore((s) => s.timeRange)
  const [live, setLive] = useState(true)
  const [commandIncident, setCommandIncident] = useState<DashboardIncident | null>(null)

  const { mode, lastSyncAt } = useDashboardLive(live)
  const { clinics, users, loading: platformLoading, error: platformError } = usePlatformData()
  const { stats, loading: statsLoading, fetching: statsFetching, error: statsError } = usePlatformStats(live)
  const {
    data,
    loading: observabilityLoading,
    fetching: observabilityFetching,
    error: observabilityError,
  } = useObservabilityData(undefined, live)

  const handleRefresh = useCallback(async () => {
    await invalidateDashboardQueries()
  }, [])

  const services = data?.apm.services ?? []
  const monitors = data?.monitors.items ?? []
  const integrations = data?.integrations ?? []
  const errors = data?.apm.errors ?? []
  const traces = data?.traces.items ?? []

  const activeClinics = stats?.clinics.byStatus.ACTIVE ?? clinics.filter((c) => c.status === 'ACTIVE').length
  const monitorsUp = monitors.filter((m) => m.status === 'up').length
  const servicesHealthy = services.filter((s) => s.status === 'healthy').length
  const availability = monitors.length ? Math.round((monitorsUp / monitors.length) * 1000) / 10 : 100
  const serviceHealth = services.length ? Math.round((servicesHealthy / services.length) * 1000) / 10 : 100
  const totalErrors = errors.reduce((sum, item) => sum + item.count, 0)

  const incidents = useMemo(
    () => buildIncidents(services, monitors, integrations, errors),
    [errors, integrations, monitors, services],
  )
  const criticalIncidents = incidents.filter((i) => i.severity === 'critical').length
  const healthScore = computePlatformHealthScore(availability, serviceHealth, criticalIncidents, totalErrors)
  const healthColor = healthScore >= 85 ? '#10b981' : healthScore >= 65 ? '#f59e0b' : '#ef4444'
  const platformStatus = healthScore >= 85 ? 'Operational' : healthScore >= 65 ? 'Degraded' : 'Critical'

  const errorBudget = useMemo(
    () => computeErrorBudget(availability, totalErrors, timeRange),
    [availability, totalErrors, timeRange],
  )

  const insights = useMemo(
    () => generateInsights({ services, errors, stats, clinics, users, timeRange }),
    [services, errors, stats, clinics, users, timeRange],
  )

  const aiops = useMemo(
    () => buildAIOpsSnapshot({
      services,
      errors,
      incidents,
      serviceMap: data?.apm.serviceMap,
      traces: data?.traces.items,
      availability,
      stats,
      timeRange,
    }),
    [services, errors, incidents, data, availability, stats, timeRange],
  )

  const trafficSeries = seriesFromReal(aggregateSeries(services.map((s) => s.series)))
  const errorSeries = seriesFromReal(errors.map((e) => e.count))
  const availabilitySeries = seriesFromReal(monitors.map((m) => (m.status === 'up' ? 100 : m.status === 'degraded' ? 85 : 0)))

  const kpiItems: KpiItem[] = [
    {
      label: 'Platform Health',
      value: String(healthScore),
      unit: '/100',
      color: healthColor,
      trend: platformStatus,
      positive: healthScore >= 85,
      series: trafficSeries.length > 1 ? trafficSeries : undefined,
    },
    {
      label: 'Availability',
      value: String(availability),
      unit: '%',
      color: '#10b981',
      trend: `${monitorsUp}/${monitors.length || monitorsUp} up`,
      positive: availability >= 99,
      series: availabilitySeries.length > 1 ? availabilitySeries : undefined,
    },
    {
      label: 'Active Clinics',
      value: String(activeClinics),
      color: '#06b6d4',
      trend: `${stats?.clinics.total ?? clinics.length} total`,
      positive: activeClinics > 0,
    },
    {
      label: 'Error Budget',
      value: String(errorBudget.remainingPct),
      unit: '%',
      color: errorBudget.color,
      trend: errorBudget.label,
      positive: errorBudget.state === 'healthy',
      burnRate: String(errorBudget.burnRate),
      exhaustionLabel: errorBudget.exhaustionLabel,
      state: errorBudget.state,
      series: errorSeries.length > 1 ? errorSeries : undefined,
    },
    {
      label: 'Critical Incidents',
      value: String(criticalIncidents),
      color: '#ef4444',
      trend: `${incidents.length} total`,
      positive: criticalIncidents === 0,
      series: errorSeries.length > 1 ? errorSeries : undefined,
    },
  ]

  const slowTraceCount = traces.filter((t) => t.status === 'slow').length
  const initialLoading = platformLoading || observabilityLoading || statsLoading
  const backgroundFetching = observabilityFetching || statsFetching
  const hasGrowthData = clinics.some((c) => c.createdAt)

  return (
    <ObservabilityPage>
      <PageMotion motionKey={location.key}>
      <DashboardEntrance delay={DASHBOARD_MOTION.headerDelayMs} variant="slideRight">
        <AdvancedPageHeader
          title="MediCare Command Center"
          eyebrow="Platform Overview"
          description="Operational intelligence for business pulse, infrastructure health, and incident response."
          icon={LayoutDashboard}
          color={healthColor}
          status={initialLoading ? 'Loading…' : platformStatus}
          compact
        />
      </DashboardEntrance>

      {(platformError || observabilityError || statsError) && (
        <DashboardEntrance delay={60} variant="fadeUp">
          <Alert severity="warning" sx={{ flexShrink: 0 }}>
            {platformError || observabilityError || statsError}
          </Alert>
        </DashboardEntrance>
      )}

      <DashboardEntrance delay={DASHBOARD_MOTION.toolbarDelayMs} variant="fadeUp">
        <DashboardLiveBar
          live={live}
          onLiveChange={setLive}
          mode={mode}
          lastSyncAt={lastSyncAt}
          timeRange={timeRange}
          onRefresh={() => void handleRefresh()}
          fetching={backgroundFetching}
        />
      </DashboardEntrance>

      <KpiStrip items={kpiItems} />

      <DashboardEntrance delay={DASHBOARD_MOTION.telemetryDelayMs} variant="fadeUp">
        <LiveTelemetryRow
          services={services}
          errors={errors}
          healthScore={healthScore}
          availability={availability}
          throughput={data?.apm.throughput}
          live={live}
        />
      </DashboardEntrance>

      <PbiGrid spacing={1.5}>
        <AnimatedGridItem index={0} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, lg: 8 }}>
          <AIOpsCommandCenter snapshot={aiops} />
        </AnimatedGridItem>
        <AnimatedGridItem index={1} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, lg: 4 }}>
          <ExecutiveSummaryCard summary={aiops.executiveSummary} services={services} incidents={incidents} />
        </AnimatedGridItem>

        <AnimatedGridItem index={2} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, lg: 8 }}>
          <AiInsightsPanel insights={insights} />
        </AnimatedGridItem>
        <AnimatedGridItem index={3} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, lg: 4 }}>
          <Panel title="Operations Queue" caption="incidents · slow traces">
            <OperationsQueue incidents={incidents} slowTraceCount={slowTraceCount} embedded />
          </Panel>
        </AnimatedGridItem>

        <AnimatedGridItem index={4} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, md: 6 }}>
          <Panel title="Business Pulse" caption={`${timeRange} window`}>
            <SectionHeading title="Activation Funnel" caption="codes → signup → clinic → active" />
            <Suspense fallback={<ChartFallback />}>
              <ActivationFunnelChart stats={stats} />
            </Suspense>
            <Box sx={{ mt: 2 }}>
              <SectionHeading title="Clinic Growth" caption="cumulative by month" />
              <Suspense fallback={<ChartFallback />}>
                {hasGrowthData ? <ClinicGrowthChart clinics={clinics} /> : <TelemetryPlaceholder label="Growth chart needs clinic createdAt data." />}
              </Suspense>
            </Box>
          </Panel>
        </AnimatedGridItem>

        <AnimatedGridItem index={5} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, md: 6 }}>
          <Panel title="Infrastructure" caption="service matrix · latency">
            <SectionHeading title="Service Health" caption="p95 · error rate · requests" />
            <ServiceHealthMatrix services={services} embedded />
            <Box sx={{ mt: 2 }}>
              <SectionHeading title="Latency Heatmap" caption="p95 by service" />
              <Suspense fallback={<ChartFallback />}>
                {services.length
                  ? <LatencyHeatmapChart services={services} latencySeries={data?.apm.latencySeries} />
                  : <TelemetryPlaceholder label="No latency series yet." />}
              </Suspense>
            </Box>
          </Panel>
        </AnimatedGridItem>

        <AnimatedGridItem index={6} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, lg: 7 }}>
          <IncidentPanel incidents={incidents} onSelectIncident={setCommandIncident} />
        </AnimatedGridItem>
        <AnimatedGridItem index={7} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, lg: 5 }}>
          <Panel title="Error Distribution" caption="click a node to filter logs">
            <Suspense fallback={<ChartFallback />}>
              {errors.length ? <ErrorTreemapChart errors={errors} /> : <TelemetryPlaceholder label="No errors in this window." />}
            </Suspense>
          </Panel>
        </AnimatedGridItem>

        <AnimatedGridItem index={8} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, md: 6 }}>
          <LogsPreview />
        </AnimatedGridItem>
        <AnimatedGridItem index={9} baseDelay={DASHBOARD_MOTION.gridBaseDelayMs} size={{ xs: 12, md: 6 }}>
          <IntegrationPanel integrations={integrations} />
        </AnimatedGridItem>
      </PbiGrid>

      <IncidentCommandDrawer
        incident={commandIncident}
        services={services}
        errors={errors}
        open={Boolean(commandIncident)}
        onClose={() => setCommandIncident(null)}
      />
      </PageMotion>
    </ObservabilityPage>
  )
}
