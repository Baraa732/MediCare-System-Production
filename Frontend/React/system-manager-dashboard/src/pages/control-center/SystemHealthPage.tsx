import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  Server,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  EmptyState,
  FilterDropdown,
  HealthBadge,
  SearchInput,
  WidgetHeader,
} from '../../components/ui'
import { SparklineCard } from '../../components/observability'
import { CC_CHART } from '../../charts'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { useIncidentPersistence } from '../../hooks/useIncidentPersistence'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { usePlatformHealth } from '../../hooks/usePlatformHealth'
import { useQueueOverview } from '../../hooks/useQueueOverview'
import { applyIncidentState, buildPlatformAlerts } from '../../lib/platformAlerts'
import { buildLogsUrl } from '../../store/logsFilterStore'
import {
  DatabaseOverviewWidget,
  LiveSystemLoadWidget,
  SystemOverviewWidget,
} from '../../widgets'
import { buildServiceRows, buildSystemLoad } from './overviewModel'
import { CcDrawer, CcPage, healthTone } from './CcChrome'
import styles from './cc.module.css'

export default function SystemHealthPage() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const obs = useObservabilityData(undefined, live)
  const healthQ = usePlatformHealth(live)
  const queuesQ = useQueueOverview(live)
  const incidents = useIncidentPersistence()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const load = useMemo(() => buildSystemLoad(obs.data), [obs.data])
  const serviceRows = useMemo(() => buildServiceRows(obs.data), [obs.data])
  const alerts = useMemo(
    () =>
      applyIncidentState(
        buildPlatformAlerts({
          observability: obs.data,
          queues: queuesQ.data,
        }),
        incidents.records,
      ).filter((a) => a.status !== 'resolved'),
    [incidents.records, obs.data, queuesQ.data],
  )

  const probes = healthQ.health?.services ?? []
  const apm = obs.data?.apm.services ?? []
  const monitors = obs.data?.monitors.items ?? []
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const combined = probes.length
      ? probes.map((probe) => {
          const svc = apm.find((s) => s.name === probe.name)
          return {
            name: probe.name,
            probeStatus: probe.status,
            checks: probe.checks ?? {},
            apmStatus: svc?.status,
            p95: svc?.p95 ?? svc?.p50 ?? 0,
            errorRate: svc?.errorRate ?? 0,
            reqRate: svc?.reqRate ?? 0,
            series: svc?.series ?? [svc?.reqRate ?? 0],
          }
        })
      : apm.map((svc) => ({
          name: svc.name,
          probeStatus: svc.status === 'healthy' ? 'up' : svc.status === 'degraded' ? 'degraded' : 'down',
          checks: {},
          apmStatus: svc.status,
          p95: svc.p95 ?? svc.p50 ?? 0,
          errorRate: svc.errorRate,
          reqRate: svc.reqRate,
          series: svc.series ?? [svc.reqRate],
        }))
    return combined.filter((row) => {
      const matchesSearch = !q || row.name.toLowerCase().includes(q)
      const tone = healthTone(row.probeStatus)
      const matchesStatus = statusFilter === 'All' || tone === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [apm, probes, search, statusFilter])

  const selected = rows.find((r) => r.name === selectedName) ?? null
  const up = probes.filter((s) => s.status === 'up').length || apm.filter((s) => s.status === 'healthy').length
  const down = probes.filter((s) => s.status === 'down').length
  const degraded = probes.filter((s) => s.status === 'degraded').length
  const monitorUp = obs.data?.monitors.summary.up ?? monitors.filter((m) => m.status === 'up').length
  const monitorDown = obs.data?.monitors.summary.down ?? monitors.filter((m) => m.status === 'down').length
  const totalNodes = probes.length || apm.length
  const score = totalNodes ? Math.round((up / totalNodes) * 100) : monitorUp && monitors.length ? Math.round((monitorUp / monitors.length) * 100) : 0

  const kpis = [
    { id: 'score', label: 'Health score', value: score, icon: Gauge, color: score >= 90 ? CC_CHART.green : score >= 70 ? CC_CHART.amber : CC_CHART.red, trend: score >= 90 ? 'up' as const : 'down' as const, trendLabel: healthQ.health?.status ?? '%' },
    { id: 'up', label: 'Healthy', value: up, icon: CheckCircle2, color: CC_CHART.green, trend: 'up' as const, trendLabel: 'probes' },
    { id: 'deg', label: 'Degraded', value: degraded, icon: Activity, color: CC_CHART.amber, trend: degraded ? 'up' as const : 'flat' as const, trendLabel: 'nodes' },
    { id: 'down', label: 'Down', value: down, icon: AlertTriangle, color: CC_CHART.red, trend: down ? 'up' as const : 'down' as const, trendLabel: 'nodes' },
    { id: 'mon', label: 'Monitors up', value: monitorUp, icon: Server, color: CC_CHART.cyan, trend: monitorDown ? 'down' as const : 'up' as const, trendLabel: `${monitorDown} down` },
    { id: 'alerts', label: 'Firing', value: alerts.length, icon: Cpu, color: CC_CHART.red, trend: alerts.length ? 'up' as const : 'flat' as const, trendLabel: 'alerts' },
  ]

  return (
    <CcPage
      title="System Health"
      description="Platform probes, monitors, and live load"
      loading={healthQ.loading || obs.loading}
      onRefresh={() => {
        void healthQ.refresh()
        void obs.refresh()
        void queuesQ.refresh()
      }}
      kpis={kpis}
      sectionTitle="Platform status"
      sectionMeta={`${healthQ.health?.status ?? 'unknown'} · ${alerts.length} firing · load ${load.overall}%`}
    >
      <div className={styles.grid}>
        <div className={styles.span6}>
          <LiveSystemLoadWidget delay={0.04} load={load} />
        </div>
        <div className={styles.span6}>
          <DatabaseOverviewWidget
            delay={0.06}
            health={healthQ.health}
            onSelect={(name) => navigate(name === 'Kafka' ? '/cc/queues' : '/cc/databases')}
          />
        </div>
        <div className={styles.span12}>
          <SystemOverviewWidget delay={0.08} rows={serviceRows} loading={obs.loading} />
        </div>
        <div className={styles.span12}>
          <DashboardCard minHeight={360} delay={0.1}>
            <WidgetHeader title="Health probes" subtitle="Click a node for checks, logs, and traces" />
            <div className={styles.toolbar}>
              <SearchInput placeholder="Search services…" value={search} onChange={setSearch} />
              <FilterDropdown
                label="Status"
                value={statusFilter}
                options={['All', 'Healthy', 'Warning', 'Critical']}
                onChange={setStatusFilter}
              />
            </div>
            {!rows.length ? (
              <EmptyState title="No probes" hint={healthQ.error ?? 'Waiting for platform health.'} />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Probe</th>
                      <th>p95</th>
                      <th>Error %</th>
                      <th>Req/s</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.name}
                        className={selectedName === row.name ? styles.selected : undefined}
                        onClick={() => setSelectedName(row.name)}
                      >
                        <td className={styles.name}>{row.name}</td>
                        <td><HealthBadge status={healthTone(row.probeStatus)} /></td>
                        <td className={styles.mono}>{Math.round(row.p95)} ms</td>
                        <td className={row.errorRate > 1 ? styles.error : styles.mono}>{row.errorRate.toFixed(2)}%</td>
                        <td className={styles.mono}>{row.reqRate.toFixed(2)}</td>
                        <td>
                          <SparklineCard data={row.series} color={healthTone(row.probeStatus) === 'Critical' ? CC_CHART.red : CC_CHART.cyan} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>
        <div className={styles.span12}>
          <DashboardCard minHeight={240} delay={0.12}>
            <WidgetHeader title="Monitors" subtitle={`${monitorUp} up · ${monitorDown} down`} />
            {!monitors.length ? (
              <EmptyState title="No monitors" hint="Backend health probes populate this list." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Monitor</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Availability</th>
                      <th>Avg duration</th>
                      <th>Last check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.map((m) => (
                      <tr key={m.id} onClick={() => navigate(buildLogsUrl({ search: m.name }))}>
                        <td className={styles.name}>{m.name}</td>
                        <td className={styles.mono}>{m.type}</td>
                        <td><HealthBadge status={healthTone(m.status)} /></td>
                        <td className={styles.mono}>{m.availability.toFixed(1)}%</td>
                        <td className={styles.mono}>{m.avgDuration != null ? `${Math.round(m.avgDuration)} ms` : '—'}</td>
                        <td className={styles.mono}>{m.lastCheck ? new Date(m.lastCheck).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      {selected ? (
        <CcDrawer
          title={selected.name}
          subtitle="Live probe + APM"
          badge={<HealthBadge status={healthTone(selected.probeStatus)} />}
          onClose={() => setSelectedName(null)}
        >
          <dl>
            {[
              ['Probe', selected.probeStatus],
              ['APM', selected.apmStatus ?? '—'],
              ['p95', `${Math.round(selected.p95)} ms`],
              ['Error rate', `${selected.errorRate.toFixed(2)}%`],
              ['Request rate', `${selected.reqRate.toFixed(2)} /s`],
              ['Checks', String(Object.keys(selected.checks).length)],
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
              {Object.keys(selected.checks).length ? (
                Object.entries(selected.checks).map(([key, value]) => (
                  <div key={key} className={styles.check}>
                    <span>{key}</span>
                    <HealthBadge status={healthTone(value)} />
                  </div>
                ))
              ) : (
                <div className={styles.drawerSub}>No nested checks on this probe.</div>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            <AnimatedButton onClick={() => navigate(buildLogsUrl({ services: [selected.name] }))}>Open logs</AnimatedButton>
            <AnimatedButton onClick={() => navigate(`/cc/tracing?service=${encodeURIComponent(selected.name)}`)}>Open traces</AnimatedButton>
            <AnimatedButton onClick={() => navigate('/cc/infrastructure')}>Open infrastructure</AnimatedButton>
            {alerts.some((a) => a.service === selected.name) ? (
              <AnimatedButton onClick={() => navigate('/alerts')}>Open alerts</AnimatedButton>
            ) : null}
          </div>
        </CcDrawer>
      ) : null}
    </CcPage>
  )
}
