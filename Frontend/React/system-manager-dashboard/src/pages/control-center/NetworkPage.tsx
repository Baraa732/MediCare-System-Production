import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  GitBranch,
  Globe,
  Plug,
  Zap,
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
import { CC_CHART } from '../../charts'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { buildLogsUrl } from '../../store/logsFilterStore'
import {
  DistributedTracingWidget,
  NetworkTrafficWidget,
} from '../../widgets'
import type { ApmService, PlatformIntegration } from '../../api/types'
import { CcDrawer, CcPage, healthTone } from './CcChrome'
import styles from './cc.module.css'

type Selection =
  | { kind: 'service'; name: string }
  | { kind: 'integration'; name: string }
  | null

export default function NetworkPage() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const obs = useObservabilityData(undefined, live)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selected, setSelected] = useState<Selection>(null)

  const services = obs.data?.apm.services ?? []
  const integrations = obs.data?.integrations ?? []
  const throughput = obs.data?.apm.throughput
  const map = obs.data?.apm.serviceMap
  const edges = (map?.edges ?? []).map((e) =>
    Array.isArray(e)
      ? { source: e[0], target: e[1] }
      : { source: (e as { source: string }).source, target: (e as { target: string }).target },
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q)
      const tone = healthTone(s.status)
      const matchesStatus = statusFilter === 'All' || tone === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, services, statusFilter])

  const selectedService = selected?.kind === 'service'
    ? services.find((s) => s.name === selected.name) ?? null
    : null
  const selectedIntegration = selected?.kind === 'integration'
    ? integrations.find((i) => i.name === selected.name) ?? null
    : null

  const ingress = throughput?.current ?? services.reduce((n, s) => n + (s.reqRate || 0), 0)
  const errorReq = services.reduce((n, s) => n + ((s.reqRate || 0) * (s.errorRate || 0)) / 100, 0)
  const connected = integrations.filter((i) => i.status === 'connected').length
  const failed = integrations.filter((i) => i.status === 'error').length
  const peak = throughput?.peak ?? 0

  const kpis = [
    { id: 'in', label: 'Ingress', value: ingress, icon: Zap, color: CC_CHART.cyan, trend: 'up' as const, trendLabel: throughput?.unit ?? 'req/s', decimals: 2 },
    { id: 'err', label: 'Error traffic', value: errorReq, icon: AlertTriangle, color: CC_CHART.red, trend: errorReq ? 'up' as const : 'down' as const, trendLabel: 'req/s', decimals: 2 },
    { id: 'peak', label: 'Peak', value: peak, icon: Activity, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: 'window', decimals: 2 },
    { id: 'edges', label: 'Edges', value: edges.length, icon: GitBranch, color: CC_CHART.green, trend: 'flat' as const, trendLabel: map?.simulated ? 'estimated' : 'live' },
    { id: 'ok', label: 'Integrations up', value: connected, icon: Plug, color: CC_CHART.green, trend: 'up' as const, trendLabel: `${integrations.length} total` },
    { id: 'fail', label: 'Integrations down', value: failed, icon: Globe, color: CC_CHART.red, trend: failed ? 'up' as const : 'down' as const, trendLabel: 'connectivity' },
  ]

  return (
    <CcPage
      title="Network"
      description="Ingress, service-map edges, and integration connectivity — egress is not exported"
      loading={obs.loading}
      onRefresh={() => void obs.refresh()}
      kpis={kpis}
      sectionTitle="Traffic and connectivity"
      sectionMeta={throughput?.source ? `via ${throughput.source}` : 'APM + integration probes'}
    >
      <div className={styles.grid}>
        <div className={styles.span6}>
          <NetworkTrafficWidget delay={0.04} observability={obs.data} />
        </div>
        <div className={styles.span6}>
          <DashboardCard minHeight={280} delay={0.06}>
            <WidgetHeader title="Connections" subtitle={map?.simulated ? 'Topology · estimated' : 'Service map edges'} />
            {!edges.length ? (
              <EmptyState title="No service-map edges" hint="Waiting for topology from observability." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.slice(0, 24).map((e, i) => (
                      <tr key={`${e.source}-${e.target}-${i}`} onClick={() => setSelected({ kind: 'service', name: e.source })}>
                        <td className={styles.name}>{e.source}</td>
                        <td className={styles.mono}>{e.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>

        <div className={styles.span12}>
          <DistributedTracingWidget
            delay={0.08}
            observability={obs.data}
            onNodeClick={(name) => setSelected({ kind: 'service', name })}
          />
        </div>

        <div className={styles.span12}>
          <DashboardCard minHeight={320} delay={0.1}>
            <WidgetHeader title="Service traffic" subtitle="Ingress by service (egress not exported)" />
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
              <EmptyState title="No traffic" hint={obs.error ?? 'APM services empty.'} />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Ingress</th>
                      <th>Error %</th>
                      <th>p95</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr
                        key={s.name}
                        className={selected?.kind === 'service' && selected.name === s.name ? styles.selected : undefined}
                        onClick={() => setSelected({ kind: 'service', name: s.name })}
                      >
                        <td className={styles.name}>{s.name}</td>
                        <td><HealthBadge status={healthTone(s.status)} /></td>
                        <td className={styles.mono}>{s.reqRate.toFixed(2)} /s</td>
                        <td className={s.errorRate > 1 ? styles.error : styles.mono}>{s.errorRate.toFixed(2)}%</td>
                        <td className={styles.mono}>{Math.round(s.p95 ?? s.p50)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>

        <div className={styles.span12}>
          <DashboardCard minHeight={280} delay={0.12}>
            <WidgetHeader title="Integrations" subtitle="External connectivity probes" />
            {!integrations.length ? (
              <EmptyState title="No integrations" hint="Platform integration probes are empty." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Checked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrations.map((i) => (
                      <tr
                        key={i.name}
                        className={selected?.kind === 'integration' && selected.name === i.name ? styles.selected : undefined}
                        onClick={() => setSelected({ kind: 'integration', name: i.name })}
                      >
                        <td className={styles.name}>{i.name}</td>
                        <td>{i.category}</td>
                        <td><HealthBadge status={healthTone(i.status)} /></td>
                        <td className={styles.mono}>{i.latencyMs != null ? `${i.latencyMs} ms` : '—'}</td>
                        <td className={styles.mono}>{i.checkedAt ? new Date(i.checkedAt).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      {selectedService ? (
        <ServiceDrawer
          service={selectedService}
          onClose={() => setSelected(null)}
          onTraces={() => navigate(`/cc/tracing?service=${encodeURIComponent(selectedService.name)}`)}
          onLogs={() => navigate(buildLogsUrl({ services: [selectedService.name] }))}
        />
      ) : null}

      {selectedIntegration ? (
        <IntegrationDrawer
          integration={selectedIntegration}
          onClose={() => setSelected(null)}
          onLogs={() => navigate(buildLogsUrl({ search: selectedIntegration.name }))}
          onAlerts={() => navigate('/alerts')}
        />
      ) : null}
    </CcPage>
  )
}

function ServiceDrawer({
  service,
  onClose,
  onTraces,
  onLogs,
}: {
  service: ApmService
  onClose: () => void
  onTraces: () => void
  onLogs: () => void
}) {
  return (
    <CcDrawer
      title={service.name}
      subtitle="Service traffic · ingress only"
      badge={<HealthBadge status={healthTone(service.status)} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Ingress', `${service.reqRate.toFixed(2)} /s`],
          ['Error rate', `${service.errorRate.toFixed(2)}%`],
          ['p95', `${Math.round(service.p95 ?? service.p50)} ms`],
          ['Status', service.status],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.drawerSub}>Egress bytes are not exported by Prometheus on this stack.</div>
      <div className={styles.actions}>
        <AnimatedButton onClick={onTraces}>Open traces</AnimatedButton>
        <AnimatedButton onClick={onLogs}>Open logs</AnimatedButton>
      </div>
    </CcDrawer>
  )
}

function IntegrationDrawer({
  integration,
  onClose,
  onLogs,
  onAlerts,
}: {
  integration: PlatformIntegration
  onClose: () => void
  onLogs: () => void
  onAlerts: () => void
}) {
  return (
    <CcDrawer
      title={integration.name}
      subtitle={integration.desc || integration.category}
      badge={<HealthBadge status={healthTone(integration.status)} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Category', integration.category],
          ['Status', integration.status],
          ['URL', integration.url || '—'],
          ['Latency', integration.latencyMs != null ? `${integration.latencyMs} ms` : '—'],
          ['Checked', integration.checkedAt ? new Date(integration.checkedAt).toLocaleString() : '—'],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <AnimatedButton onClick={onLogs}>Search logs</AnimatedButton>
        {integration.status === 'error' ? <AnimatedButton onClick={onAlerts}>Open alerts</AnimatedButton> : null}
      </div>
    </CcDrawer>
  )
}
