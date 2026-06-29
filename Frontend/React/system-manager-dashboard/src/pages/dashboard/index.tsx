import { lazy, Suspense, useMemo, useState } from 'react'
import { Alert, Box, Grid, LinearProgress } from '@mui/material'
import { AdvancedPageHeader, ObservabilityPage, PbiGrid } from '../../components/advanced/AdvancedPage'
import LogsPreview from '../../components/dashboard/LogsPreview'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { usePlatformData } from '../../hooks/usePlatformData'
import { usePlatformStats } from '../../hooks/usePlatformStats'
import { useDashboardStore } from '../../store/dashboardStore'
import KpiStrip from './components/KpiStrip'
import type { KpiItem } from './components/KpiStrip'
import AIOpsCommandCenter from './components/AIOpsCommandCenter'
import ExecutiveSummaryCard from './components/ExecutiveSummaryCard'
import AiInsightsPanel from './components/AiInsightsPanel'
import IncidentCommandDrawer from './components/IncidentCommandDrawer'
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

/** Command Center — enterprise layout with sticky KPI strip. */
export default function Dashboard() {
  const timeRange = useDashboardStore((s) => s.timeRange)
  const [commandIncident, setCommandIncident] = useState<DashboardIncident | null>(null)
  const { clinics, users, loading: platformLoading, error: platformError } = usePlatformData()
  const { stats, loading: statsLoading, error: statsError } = usePlatformStats()
  const { data, loading: observabilityLoading, error: observabilityError } = useObservabilityData(undefined, true)

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
  const loading = platformLoading || observabilityLoading || statsLoading
  const hasGrowthData = clinics.some((c) => c.createdAt)

  return (
    <ObservabilityPage>
      <AdvancedPageHeader
        title="MediCare Command Center"
        eyebrow="Platform Overview"
        description="Unified operational view — business pulse, infrastructure health, and live incidents."
        color={healthColor}
        status={loading ? 'Syncing…' : platformStatus}
        compact
      />

      {(platformError || observabilityError || statsError) && (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>
          {platformError || observabilityError || statsError}
        </Alert>
      )}

      <KpiStrip items={kpiItems} />

      <Grid container spacing={1.5} sx={{ mb: 0.5 }}>
        <Grid size={{ xs: 12 }}>
          <AIOpsCommandCenter snapshot={aiops} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ExecutiveSummaryCard summary={aiops.executiveSummary} services={services} incidents={incidents} />
        </Grid>
      </Grid>

      <PbiGrid spacing={1.5}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <AiInsightsPanel insights={insights} />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Panel title="Business Pulse" caption={`activation funnel · growth · ${timeRange} window`} fillHeight>
            <SectionHeading title="Activation Funnel" caption="codes → signup → clinic → active" />
            <Suspense fallback={<ChartFallback />}>
              <ActivationFunnelChart stats={stats} />
            </Suspense>
            <Box sx={{ mt: 1.5 }}>
              <SectionHeading title="Growth Trend" caption="cumulative clinics by month" />
              <Suspense fallback={<ChartFallback />}>
                {hasGrowthData ? <ClinicGrowthChart clinics={clinics} /> : <TelemetryPlaceholder label="Clinic growth trend requires createdAt timestamps." />}
              </Suspense>
            </Box>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Panel title="Infrastructure Health" caption="service matrix · latency heatmap" fillHeight>
            <ServiceHealthMatrix services={services} />
            <Box sx={{ mt: 1.5 }}>
              <SectionHeading title="Latency Heatmap" caption="p95 by service · recent buckets" />
              <Suspense fallback={<ChartFallback />}>
                {services.length ? <LatencyHeatmapChart services={services} /> : <TelemetryPlaceholder label="No latency series available yet." />}
              </Suspense>
            </Box>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <IncidentPanel incidents={incidents} onSelectIncident={setCommandIncident} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Panel title="Error Treemap" caption="click a node to open filtered logs">
            <Suspense fallback={<ChartFallback />}>
              {errors.length ? <ErrorTreemapChart errors={errors} /> : <TelemetryPlaceholder label="No error groups in the current window." />}
            </Suspense>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <LogsPreview />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <IntegrationPanel integrations={integrations} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <OperationsQueue incidents={incidents} slowTraceCount={slowTraceCount} />
        </Grid>
      </PbiGrid>

      <IncidentCommandDrawer
        incident={commandIncident}
        services={services}
        errors={errors}
        open={Boolean(commandIncident)}
        onClose={() => setCommandIncident(null)}
      />
    </ObservabilityPage>
  )
}
