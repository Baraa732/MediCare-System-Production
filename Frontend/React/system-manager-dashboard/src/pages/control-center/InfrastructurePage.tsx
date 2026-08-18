import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  Cpu,
  HardDrive,
  MapPin,
  Server,
  X,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  DateSelector,
  EmptyState,
  HealthBadge,
  SearchInput,
  SectionHeader,
  WidgetHeader,
} from '../../components/ui'
import { LiveIndicator, MetricCard, SparklineCard } from '../../components/observability'
import { staggerContainer } from '../../animations/variants'
import { CC_CHART } from '../../charts'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { usePlatformHealth } from '../../hooks/usePlatformHealth'
import { usePlatformData } from '../../hooks/usePlatformData'
import { useQueueOverview } from '../../hooks/useQueueOverview'
import { useDeployments } from '../../hooks/useDeployments'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import {
  timeRangeLabel,
  useDashboardStore,
  normalizeTimeRange,
} from '../../store/dashboardStore'
import { buildLogsUrl } from '../../store/logsFilterStore'
import { buildSystemLoad } from './overviewModel'
import type { ApmService, Clinic, PlatformHealth } from '../../api/types'
import {
  DatabaseOverviewWidget,
  InfrastructureMapWidget,
  LiveSystemLoadWidget,
  QueueOverviewWidget,
  RecentDeploymentsWidget,
  ResourceUsageWidget,
} from '../../widgets'
import styles from './cc.module.css'

function tone(status: string): 'Healthy' | 'Warning' | 'Critical' {
  if (status === 'healthy' || status === 'up' || status === 'ok' || status === 'ACTIVE') return 'Healthy'
  if (status === 'degraded' || status === 'unknown' || status === 'PENDING') return 'Warning'
  return 'Critical'
}

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InfrastructurePage() {
  const navigate = useNavigate()
  const timeRange = useDashboardStore((s) => s.timeRange)
  const setTimeRange = useDashboardStore((s) => s.setTimeRange)
  const { live, lastSyncAt, mode } = useDashboardLive(true)
  const obs = useObservabilityData(undefined, live)
  const healthQ = usePlatformHealth(live)
  const queuesQ = useQueueOverview(live)
  const deploymentsQ = useDeployments(live)
  const { clinics } = usePlatformData({ loadStaff: false, live: false })

  const [search, setSearch] = useState('')
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)

  const load = useMemo(() => buildSystemLoad(obs.data), [obs.data])
  const services = obs.data?.apm.services ?? []
  const healthByName = new Map((healthQ.health?.services ?? []).map((s) => [s.name, s]))

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => {
        const probe = healthByName.get(s.name)
        return {
          ...s,
          probeStatus: probe?.status ?? (s.status === 'healthy' ? 'up' : s.status === 'degraded' ? 'degraded' : 'down'),
          checks: probe?.checks,
        }
      })
  }, [healthByName, search, services])

  const selected = rows.find((s) => s.name === selectedService) ?? null
  const up = (healthQ.health?.services ?? []).filter((s) => s.status === 'up').length
  const down = (healthQ.health?.services ?? []).filter((s) => s.status === 'down').length
  const infraOk = Object.values(healthQ.health?.infrastructure ?? {}).filter((v) => v === 'ok').length

  const kpis = [
    { id: 'nodes', label: 'Probed nodes', value: healthQ.health?.services.length || services.length, icon: Server, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: healthQ.health?.status ?? '—' },
    { id: 'up', label: 'Healthy', value: up || services.filter((s) => s.status === 'healthy').length, icon: CheckCircle2, color: CC_CHART.green, trend: 'up' as const, trendLabel: 'live' },
    { id: 'down', label: 'Down', value: down, icon: Activity, color: CC_CHART.red, trend: down ? 'up' as const : 'down' as const, trendLabel: 'probes' },
    { id: 'cpu', label: 'CPU', value: load.cpu ?? 0, icon: Cpu, color: CC_CHART.amber, trend: (load.cpu ?? 0) > 70 ? 'up' as const : 'down' as const, trendLabel: load.cpu == null ? 'n/a' : '%' },
    { id: 'ram', label: 'RAM pressure', value: load.memory ?? 0, icon: HardDrive, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: '%' },
    { id: 'clinics', label: 'Clinics', value: clinics.length, icon: MapPin, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: `${infraOk}/3 infra` },
  ]

  const syncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString()
    : obs.dataUpdatedAt
      ? new Date(obs.dataUpdatedAt).toLocaleTimeString()
      : '—'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Infrastructure</h1>
          <p className={styles.heroMeta}>
            Live health probes · Kafka · Redis · clinic fleet · synced {syncLabel} · {mode}
          </p>
        </div>
        <div className={styles.heroActions}>
          <LiveIndicator />
          <DateSelector
            value={timeRangeLabel(timeRange)}
            onChange={(v) => setTimeRange(normalizeTimeRange(v))}
          />
          <AnimatedButton
            onClick={() => {
              void obs.refresh()
              void healthQ.refresh()
              void queuesQ.refresh()
              void deploymentsQ.refresh()
            }}
          >
            Refresh
          </AnimatedButton>
        </div>
      </header>

      <SectionHeader
        title="Capacity and health"
        meta={obs.loading ? 'Loading probes…' : `${rows.length} services · ${clinics.length} tenants`}
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
            delay={i * 0.04}
            sparkColor={kpi.color}
          />
        ))}
      </motion.div>

      <div className={styles.grid}>
        <div className={styles.span12}>
          <DashboardCard minHeight={360} delay={0.08}>
            <WidgetHeader title="Service nodes" subtitle="Health · p95 · CPU · RAM" badge={<LiveIndicator />} />
            <div className={styles.toolbar}>
              <SearchInput placeholder="Filter services…" value={search} onChange={setSearch} style={{ minWidth: 240 }} />
            </div>
            {!rows.length ? (
              <EmptyState title="No infrastructure nodes" hint="Waiting for platform health and APM." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Probe</th>
                      <th>p95</th>
                      <th>CPU</th>
                      <th>Memory</th>
                      <th>Req/s</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.name} onClick={() => setSelectedService(row.name)}>
                        <td className={styles.name}>{row.name}</td>
                        <td>
                          <HealthBadge status={tone(row.probeStatus)} />
                        </td>
                        <td className={styles.mono}>{Math.round(row.p95 ?? row.p50 ?? 0)}ms</td>
                        <td className={styles.mono}>{row.cpuPercent != null ? `${Math.round(row.cpuPercent)}%` : '—'}</td>
                        <td className={styles.mono}>{formatBytes(row.memoryBytes)}</td>
                        <td className={styles.mono}>{row.reqRate.toFixed(2)}</td>
                        <td>
                          <SparklineCard data={row.series?.length ? row.series : [row.reqRate]} color={CC_CHART.cyan} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>

        <div className={styles.span6}>
          <LiveSystemLoadWidget delay={0.12} load={load} />
        </div>
        <div className={styles.span6}>
          <DatabaseOverviewWidget delay={0.14} health={healthQ.health} />
        </div>

        <div className={styles.span12}>
          <InfrastructureMapWidget delay={0.16} clinics={clinics} onSelectClinic={setSelectedClinic} />
        </div>

        <div className={styles.span6}>
          <QueueOverviewWidget delay={0.18} queues={queuesQ.data} />
        </div>
        <div className={styles.span6}>
          <RecentDeploymentsWidget delay={0.2} deployments={deploymentsQ.data} />
        </div>

        <div className={styles.span12}>
          <ResourceUsageWidget delay={0.22} observability={obs.data} />
        </div>
      </div>

      {selected ? (
        <NodeDrawer
          service={selected}
          health={healthQ.health}
          onClose={() => setSelectedService(null)}
          onLogs={() => navigate(buildLogsUrl({ services: [selected.name] }))}
          onTraces={() => navigate(`/cc/tracing?service=${encodeURIComponent(selected.name)}`)}
        />
      ) : null}

      {selectedClinic ? (
        <ClinicDrawer clinic={selectedClinic} onClose={() => setSelectedClinic(null)} />
      ) : null}
    </div>
  )
}

function NodeDrawer({
  service,
  health,
  onClose,
  onLogs,
  onTraces,
}: {
  service: ApmService & { probeStatus: string; checks?: Record<string, string> }
  health: PlatformHealth | null
  onClose: () => void
  onLogs: () => void
  onTraces: () => void
}) {
  const probe = health?.services.find((s) => s.name === service.name)
  const checks = probe?.checks ?? service.checks ?? {}
  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Close" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label={service.name}>
        <div className={styles.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <HealthBadge status={tone(service.probeStatus)} />
            <button type="button" className={styles.ghost} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className={styles.drawerTitle}>{service.name}</div>
          <div className={styles.drawerSub}>Live probe · APM process metrics</div>
        </div>
        <div className={styles.drawerBody}>
          <dl>
            {[
              ['Probe', probe?.status ?? service.probeStatus],
              ['p50 / p95 / p99', `${Math.round(service.p50)} / ${Math.round(service.p95 ?? 0)} / ${Math.round(service.p99 ?? 0)} ms`],
              ['CPU', service.cpuPercent != null ? `${Math.round(service.cpuPercent)}%` : '—'],
              ['Memory', formatBytes(service.memoryBytes)],
              ['Request rate', `${service.reqRate.toFixed(2)} /s`],
              ['Error rate', `${service.errorRate.toFixed(2)}%`],
            ].map(([k, v]) => (
              <div key={k} className={styles.kv}>
                <dt>{k}</dt>
                <dd className={styles.mono}>{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <div className={styles.drawerSub}>Dependency checks</div>
            <div className={styles.checkList}>
              {Object.keys(checks).length ? (
                Object.entries(checks).map(([key, value]) => (
                  <div key={key} className={styles.check}>
                    <span>{key}</span>
                    <HealthBadge status={tone(value)} />
                  </div>
                ))
              ) : (
                <div className={styles.drawerSub}>No nested checks on this probe.</div>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            <AnimatedButton onClick={onLogs}>Open logs</AnimatedButton>
            <AnimatedButton onClick={onTraces}>Open traces</AnimatedButton>
          </div>
        </div>
      </aside>
    </>
  )
}

function ClinicDrawer({ clinic, onClose }: { clinic: Clinic; onClose: () => void }) {
  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Close" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label={clinic.name}>
        <div className={styles.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <HealthBadge status={tone(clinic.status)} />
            <button type="button" className={styles.ghost} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className={styles.drawerTitle}>{clinic.name}</div>
          <div className={styles.drawerSub}>Tenant node</div>
        </div>
        <div className={styles.drawerBody}>
          <dl>
            {[
              ['Status', clinic.status],
              ['City', clinic.city || '—'],
              ['Governorate', clinic.governorate || '—'],
              ['Phone', clinic.phone || '—'],
              ['Email', clinic.email || '—'],
              ['Coordinates', clinic.latitude != null && clinic.longitude != null ? `${clinic.latitude.toFixed(4)}, ${clinic.longitude.toFixed(4)}` : '—'],
            ].map(([k, v]) => (
              <div key={k} className={styles.kv}>
                <dt>{k}</dt>
                <dd className={styles.mono}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </>
  )
}
