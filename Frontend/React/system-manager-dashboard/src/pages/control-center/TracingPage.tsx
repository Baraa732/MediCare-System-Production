import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Clock3,
  GitBranch,
  Timer,
  Workflow,
  X,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  DateSelector,
  EmptyState,
  SearchInput,
  SectionHeader,
  WidgetHeader,
} from '../../components/ui'
import {
  LiveIndicator,
  MetricCard,
  ObsidianTraceGraph,
  SeverityBadge,
  WidgetToolbar,
} from '../../components/observability'
import { staggerContainer } from '../../animations/variants'
import { CC_CHART } from '../../charts'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { useDistributedTrace } from '../../hooks/useDistributedTrace'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import {
  timeRangeLabel,
  useDashboardStore,
  normalizeTimeRange,
} from '../../store/dashboardStore'
import { buildLogsUrl } from '../../store/logsFilterStore'
import type { DistributedTrace, OperationalTrace, TraceSpan } from '../../api/types'
import obs from '../../components/observability/obs.module.css'
import styles from './cc.module.css'

type Tab = 'explorer' | 'map'

function statusLevel(status: string): 'Critical' | 'Warning' | 'Success' | 'Info' {
  if (status === 'error') return 'Critical'
  if (status === 'slow') return 'Warning'
  return 'Success'
}

function spansFromTrace(trace: OperationalTrace): TraceSpan[] {
  return (trace.logs ?? []).map((log, index) => ({
    spanId: log.spanId ?? `${trace.id}-${index}`,
    service: log.service,
    operation: log.message.slice(0, 80),
    durationMs: Math.max(8, Math.round(trace.duration / Math.max(1, trace.logs.length))),
    status: log.level === 'ERROR' ? 'error' : log.level === 'WARN' ? 'slow' : 'ok',
    parentSpanId: index > 0 ? (trace.logs[index - 1]?.spanId ?? `${trace.id}-${index - 1}`) : null,
  }))
}

export default function TracingPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const timeRange = useDashboardStore((s) => s.timeRange)
  const setTimeRange = useDashboardStore((s) => s.setTimeRange)
  const { live, lastSyncAt, mode } = useDashboardLive(true)
  const obsQ = useObservabilityData(undefined, live)

  const [tab, setTab] = useState<Tab>('explorer')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const serviceFilter = params.get('service') || 'All'

  const traces = obsQ.data?.traces.items ?? []
  const services = useMemo(
    () => ['All', ...Array.from(new Set(traces.map((t) => t.rootService)))],
    [traces],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return traces.filter((trace) => {
      const matchesSearch =
        !q ||
        trace.rootOp.toLowerCase().includes(q) ||
        trace.rootService.toLowerCase().includes(q) ||
        trace.id.toLowerCase().includes(q)
      const matchesService = serviceFilter === 'All' || trace.rootService === serviceFilter
      const matchesStatus = statusFilter === 'All' || trace.status === statusFilter
      return matchesSearch && matchesService && matchesStatus
    })
  }, [search, serviceFilter, statusFilter, traces])

  const selected = traces.find((t) => t.id === selectedId || t.traceId === selectedId) ?? null
  const summary = obsQ.data?.traces.summary
  const graphServices = obsQ.data?.apm.services ?? []
  const graphNodes = (obsQ.data?.apm.serviceMap.nodes?.length
    ? obsQ.data.apm.serviceMap.nodes
    : graphServices.map((s) => ({
        id: s.name,
        name: s.name,
        status: s.status,
        reqRate: s.reqRate,
        errorRate: s.errorRate,
      }))
  ).map((n) => ({
    ...n,
    p95: graphServices.find((s) => s.name === n.name || s.name === n.id)?.p95,
  }))
  const graphEdges = (obsQ.data?.apm.serviceMap.edges ?? []).map((e) =>
    Array.isArray(e)
      ? { source: e[0], target: e[1], count: 1, avgLatencyMs: 0 }
      : { source: (e as { source: string }).source, target: (e as { target: string }).target, count: 1, avgLatencyMs: 0 },
  )

  const kpis = [
    { id: 'total', label: 'Traces', value: summary?.total ?? traces.length, icon: Workflow, color: CC_CHART.cyan, trend: 'up' as const, trendLabel: 'window' },
    { id: 'errors', label: 'Errors', value: summary?.errors ?? traces.filter((t) => t.status === 'error').length, icon: AlertTriangle, color: CC_CHART.red, trend: 'flat' as const, trendLabel: 'error' },
    { id: 'slow', label: 'Slow', value: traces.filter((t) => t.status === 'slow').length, icon: Timer, color: CC_CHART.amber, trend: 'flat' as const, trendLabel: '>1s' },
    { id: 'avg', label: 'Avg duration', value: summary?.avgDuration ?? 0, icon: Clock3, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: 'ms' },
    { id: 'tp', label: 'Throughput', value: Number((summary?.throughput ?? 0).toFixed(2)), icon: Activity, color: CC_CHART.green, trend: 'up' as const, trendLabel: 'req/s', decimals: 2 },
    { id: 'svcs', label: 'Services', value: Math.max(0, services.length - 1), icon: GitBranch, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: 'roots' },
  ]

  const syncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString()
    : obsQ.dataUpdatedAt
      ? new Date(obsQ.dataUpdatedAt).toLocaleTimeString()
      : '—'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Tracing</h1>
          <p className={styles.heroMeta}>
            Distributed traces from Jaeger / correlated logs · synced {syncLabel} · {mode}
          </p>
        </div>
        <div className={styles.heroActions}>
          <LiveIndicator />
          <DateSelector
            value={timeRangeLabel(timeRange)}
            onChange={(v) => setTimeRange(normalizeTimeRange(v))}
          />
          <AnimatedButton onClick={() => void obsQ.refresh()}>Refresh</AnimatedButton>
        </div>
      </header>

      <SectionHeader
        title="Trace volume"
        meta={obsQ.loading ? 'Loading traces…' : `${filtered.length} in view · ${obsQ.data?.apm.serviceMap?.simulated ? 'estimated topology' : 'live topology'}`}
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
            decimals={'decimals' in kpi ? kpi.decimals : 0}
            delay={i * 0.04}
            sparkColor={kpi.color}
          />
        ))}
      </motion.div>

      <div className={styles.grid}>
        <div className={styles.span12}>
          <DashboardCard minHeight={480} delay={0.1}>
            <WidgetHeader
              title={tab === 'map' ? 'Service map' : 'Trace explorer'}
              subtitle={tab === 'map' ? 'Click a node to filter' : `${filtered.length} traces`}
              badge={<LiveIndicator />}
            />
            <WidgetToolbar
              right={(['explorer', 'map'] as Tab[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`${obs.filterChip} ${tab === item ? obs.filterChipActive : ''}`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
            />

            {tab === 'map' ? (
              <ObsidianTraceGraph
                tall
                nodes={graphNodes}
                edges={graphEdges}
                onNodeClick={(node) => {
                  setParams({ service: node.name })
                  setTab('explorer')
                }}
              />
            ) : (
              <>
                <div className={styles.toolbar}>
                  <SearchInput
                    placeholder="Search trace id, service, operation…"
                    value={search}
                    onChange={setSearch}
                    style={{ minWidth: 260 }}
                  />
                  {services.slice(0, 12).map((service) => (
                    <button
                      key={service}
                      type="button"
                      className={`${obs.filterChip} ${serviceFilter === service ? obs.filterChipActive : ''}`}
                      onClick={() => {
                        if (service === 'All') setParams({})
                        else setParams({ service })
                      }}
                    >
                      {service}
                    </button>
                  ))}
                  {(['All', 'ok', 'slow', 'error'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`${obs.filterChip} ${statusFilter === status ? obs.filterChipActive : ''}`}
                      onClick={() => setStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                {!filtered.length ? (
                  <EmptyState
                    title="No traces in this window"
                    hint="Traces come from Jaeger when available, otherwise from log lines that carry a trace id."
                  />
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Trace</th>
                          <th>Root</th>
                          <th>Operation</th>
                          <th>Duration</th>
                          <th>Spans</th>
                          <th>Errors</th>
                          <th>Started</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((trace) => (
                          <tr key={trace.id} onClick={() => setSelectedId(trace.traceId ?? trace.id)}>
                            <td>
                              <SeverityBadge level={statusLevel(trace.status)} />
                            </td>
                            <td className={styles.name}>{(trace.traceId ?? trace.id).slice(0, 10)}</td>
                            <td className={styles.mono}>{trace.rootService}</td>
                            <td className={styles.mono}>{trace.rootOp}</td>
                            <td className={trace.duration > 1000 ? styles.error : styles.mono}>{trace.duration}ms</td>
                            <td className={styles.mono}>{trace.spans}</td>
                            <td className={trace.errors ? styles.error : styles.mono}>{trace.errors || '—'}</td>
                            <td className={styles.mono}>{trace.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </DashboardCard>
        </div>
      </div>

      {selected ? (
        <TraceDrawer
          trace={selected}
          onClose={() => setSelectedId(null)}
          onLogs={() =>
            navigate(
              buildLogsUrl({
                services: [selected.rootService],
                search: selected.traceId ?? selected.id,
              }),
            )
          }
        />
      ) : null}
    </div>
  )
}

function TraceDrawer({
  trace,
  onClose,
  onLogs,
}: {
  trace: OperationalTrace
  onClose: () => void
  onLogs: () => void
}) {
  const detail = useDistributedTrace(trace.traceId ?? trace.id)
  const distributed: DistributedTrace | null = detail.trace
  const spans = distributed?.spans?.length ? distributed.spans : spansFromTrace(trace)
  const maxMs = Math.max(1, ...spans.map((s) => s.durationMs), trace.duration)

  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Close" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Trace detail">
        <div className={styles.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <SeverityBadge level={statusLevel(distributed?.status ?? trace.status)} />
            <button type="button" className={styles.ghost} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className={styles.drawerTitle}>{trace.rootService}</div>
          <div className={styles.drawerSub}>
            {(trace.traceId ?? trace.id).slice(0, 18)} · {distributed?.durationMs ?? trace.duration}ms · {spans.length} spans
            {detail.loading ? ' · loading waterfall…' : ''}
          </div>
        </div>
        <div className={styles.drawerBody}>
          <div>
            <div className={styles.drawerSub} style={{ marginBottom: 8 }}>Span waterfall</div>
            {spans.map((span) => (
              <div key={span.spanId} className={styles.spanRow}>
                <span className={styles.mono}>{span.service}</span>
                <div className={styles.spanTrack} title={span.operation}>
                  <div
                    className={`${styles.spanFill} ${span.status === 'error' ? styles.fail : span.status === 'slow' ? styles.slow : styles.ok}`}
                    style={{ width: `${Math.max(8, Math.round((span.durationMs / maxMs) * 100))}%` }}
                  />
                </div>
                <span className={styles.mono}>{span.durationMs}ms</span>
              </div>
            ))}
            {!spans.length ? <div className={styles.drawerSub}>No spans for this trace yet.</div> : null}
          </div>

          <div>
            <div className={styles.drawerSub} style={{ marginBottom: 8 }}>Correlated logs</div>
            {(trace.logs ?? []).slice(0, 12).map((log) => (
              <div key={log.id} className={styles.kv}>
                <dt>{log.level}</dt>
                <dd className={styles.mono}>{log.message.slice(0, 120)}</dd>
              </div>
            ))}
            {!trace.logs?.length ? <div className={styles.drawerSub}>No log lines attached.</div> : null}
          </div>

          <div className={styles.actions}>
            <AnimatedButton onClick={onLogs}>Open in logs</AnimatedButton>
          </div>
        </div>
      </aside>
    </>
  )
}
