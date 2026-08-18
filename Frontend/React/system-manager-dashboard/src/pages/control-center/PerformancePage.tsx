import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Clock3,
  Gauge,
  Timer,
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
import { ChartCard, LiveIndicator, SparklineCard } from '../../components/observability'
import { CC_CHART, multiLineOption } from '../../charts'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { buildLogsUrl } from '../../store/logsFilterStore'
import {
  ErrorRateWidget,
  ResourceUsageWidget,
  TopServicesWidget,
} from '../../widgets'
import type { ApmService } from '../../api/types'
import { CcDrawer, CcPage, healthTone } from './CcChrome'
import styles from './cc.module.css'

type SortKey = 'name' | 'p50' | 'p95' | 'p99' | 'errorRate' | 'reqRate'

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export default function PerformancePage() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const obs = useObservabilityData(undefined, live)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('p95')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const services = obs.data?.apm.services ?? []
  const selected = services.find((s) => s.name === selectedName) ?? null

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = services.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q)
      const tone = healthTone(s.status)
      const matchesStatus = statusFilter === 'All' || tone === statusFilter
      return matchesSearch && matchesStatus
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sortKey === 'name' ? a.name : (a[sortKey] ?? 0)
      const bv = sortKey === 'name' ? b.name : (b[sortKey] ?? 0)
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return ((av as number) - (bv as number)) * dir
    })
  }, [search, services, sortDir, sortKey, statusFilter])

  const p95s = services.map((s) => s.p95 ?? s.p50).filter((n): n is number => n != null && n > 0)
  const p99s = services.map((s) => s.p99).filter((n): n is number => n != null && n > 0)
  const avgP95 = avg(p95s)
  const avgP99 = avg(p99s)
  const errRate = avg(services.map((s) => s.errorRate ?? 0))
  const throughput = obs.data?.apm.throughput?.current ?? services.reduce((n, s) => n + (s.reqRate || 0), 0)
  const slow = services.filter((s) => (s.p99 ?? s.p95 ?? 0) > 1000).length
  const erroring = services.filter((s) => s.errorRate > 1).length

  const latencyOption = useMemo(() => {
    const series = (obs.data?.apm.latencySeries ?? []).slice(0, 6)
    const labels = obs.data?.apm.throughput?.timestamps?.map((t) =>
      new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    )
    if (!series.length) return null
    const length = Math.max(...series.map((s) => s.p95.length), labels?.length ?? 0)
    if (!length) return null
    const colors = [CC_CHART.cyan, CC_CHART.purple, CC_CHART.green, CC_CHART.amber, CC_CHART.red, '#67e8f9']
    return multiLineOption({
      labels: labels?.length === length
        ? labels
        : Array.from({ length }, (_, i) => String(i + 1)),
      series: series.map((s, i) => ({
        name: `${s.name} p95`,
        data: s.p95,
        color: colors[i % colors.length],
      })),
    })
  }, [obs.data])

  const kpis = [
    { id: 'p95', label: 'Avg p95', value: avgP95, icon: Clock3, color: CC_CHART.cyan, trend: avgP95 > 800 ? 'up' as const : 'down' as const, trendLabel: 'ms' },
    { id: 'p99', label: 'Avg p99', value: avgP99, icon: Timer, color: CC_CHART.purple, trend: avgP99 > 1000 ? 'up' as const : 'flat' as const, trendLabel: 'ms' },
    { id: 'err', label: 'Error rate', value: errRate, icon: AlertTriangle, color: CC_CHART.red, trend: errRate > 1 ? 'up' as const : 'down' as const, trendLabel: '%', decimals: 2 },
    { id: 'tp', label: 'Throughput', value: throughput, icon: Zap, color: CC_CHART.green, trend: 'up' as const, trendLabel: obs.data?.apm.throughput?.unit ?? 'req/s', decimals: 2 },
    { id: 'slow', label: 'Slow services', value: slow, icon: Gauge, color: CC_CHART.amber, trend: slow ? 'up' as const : 'down' as const, trendLabel: 'p99 > 1s' },
    { id: 'errs', label: 'Erroring', value: erroring, icon: Activity, color: CC_CHART.red, trend: erroring ? 'up' as const : 'flat' as const, trendLabel: '>1%' },
  ]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  return (
    <CcPage
      title="Performance"
      description="Live APM latency, error rate, and throughput"
      loading={obs.loading}
      onRefresh={() => void obs.refresh()}
      kpis={kpis}
      sectionTitle="Service latency"
      sectionMeta={`${services.length} services · ${slow} above 1s p99`}
    >
      <div className={styles.grid}>
        <div className={styles.span8}>
          {latencyOption ? (
            <ChartCard
              title="p95 by service"
              subtitle="APM latency series"
              badge={<LiveIndicator />}
              option={latencyOption}
              height={200}
              delay={0.04}
              minHeight={280}
              ariaLabel="p95 latency"
            />
          ) : (
            <ChartCard title="p95 by service" subtitle="APM latency series" badge={<LiveIndicator />} delay={0.04} minHeight={280}>
              <EmptyState title="No latency series" hint="Waiting for APM p95 samples." />
            </ChartCard>
          )}
        </div>
        <div className={styles.span4}>
          <ErrorRateWidget delay={0.06} observability={obs.data} />
        </div>
        <div className={styles.span6}>
          <TopServicesWidget delay={0.08} observability={obs.data} />
        </div>
        <div className={styles.span6}>
          <ResourceUsageWidget delay={0.1} observability={obs.data} />
        </div>
        <div className={styles.span12}>
          <DashboardCard minHeight={360} delay={0.12}>
            <WidgetHeader title="Latency table" subtitle="Click a header to sort · click a row for traces" />
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
              <EmptyState title="No APM services" hint={obs.error ?? 'Observability feed is empty.'} />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {([
                        ['name', 'Service'],
                        ['p50', 'p50'],
                        ['p95', 'p95'],
                        ['p99', 'p99'],
                        ['errorRate', 'Error %'],
                        ['reqRate', 'Req/s'],
                      ] as Array<[SortKey, string]>).map(([key, label]) => (
                        <th key={key}>
                          <button type="button" className={styles.ghost} onClick={() => toggleSort(key)}>
                            {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr
                        key={s.name}
                        className={selectedName === s.name ? styles.selected : undefined}
                        onClick={() => setSelectedName(s.name)}
                      >
                        <td className={styles.name}>{s.name}</td>
                        <td className={styles.mono}>{Math.round(s.p50)} ms</td>
                        <td className={styles.mono}>{Math.round(s.p95 ?? 0)} ms</td>
                        <td className={(s.p99 ?? 0) > 1000 ? styles.error : styles.mono}>{Math.round(s.p99 ?? 0)} ms</td>
                        <td className={s.errorRate > 1 ? styles.error : styles.mono}>{s.errorRate.toFixed(2)}%</td>
                        <td className={styles.mono}>{s.reqRate.toFixed(2)}</td>
                        <td>
                          <SparklineCard
                            data={s.series?.length ? s.series : [s.reqRate]}
                            color={s.errorRate > 1 ? CC_CHART.red : CC_CHART.cyan}
                          />
                        </td>
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
        <ServiceDrawer
          service={selected}
          onClose={() => setSelectedName(null)}
          onLogs={() => navigate(buildLogsUrl({ services: [selected.name] }))}
          onTraces={() => navigate(`/cc/tracing?service=${encodeURIComponent(selected.name)}`)}
        />
      ) : null}
    </CcPage>
  )
}

function ServiceDrawer({
  service,
  onClose,
  onLogs,
  onTraces,
}: {
  service: ApmService
  onClose: () => void
  onLogs: () => void
  onTraces: () => void
}) {
  return (
    <CcDrawer
      title={service.name}
      subtitle="APM latency and error profile"
      badge={<HealthBadge status={healthTone(service.status)} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Status', service.status],
          ['p50 / p95 / p99', `${Math.round(service.p50)} / ${Math.round(service.p95 ?? 0)} / ${Math.round(service.p99 ?? 0)} ms`],
          ['Request rate', `${service.reqRate.toFixed(2)} /s`],
          ['Error rate', `${service.errorRate.toFixed(2)}%`],
          ['Instances', String(service.instances)],
          ['CPU', service.cpuPercent != null ? `${Math.round(service.cpuPercent)}%` : '—'],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <AnimatedButton onClick={onTraces}>Open traces</AnimatedButton>
        <AnimatedButton onClick={onLogs}>Open logs</AnimatedButton>
      </div>
    </CcDrawer>
  )
}
