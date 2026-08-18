import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Siren,
  VolumeX,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  EmptyState,
  SearchInput,
  SectionHeader,
  WidgetHeader,
} from '../../components/ui'
import { LiveIndicator, MetricCard, SeverityBadge, WidgetToolbar } from '../../components/observability'
import { staggerContainer } from '../../animations/variants'
import { CC_CHART } from '../../charts'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { useIncidentPersistence } from '../../hooks/useIncidentPersistence'
import { usePrometheusAlerts } from '../../hooks/usePrometheusAlerts'
import { useQueueOverview } from '../../hooks/useQueueOverview'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { notify } from '../../lib/toast'
import {
  applyIncidentState,
  BUILTIN_RULES,
  buildPlatformAlerts,
  firingAlerts,
  formatAlertAgo,
  type AlertRule,
  type PlatformAlert,
} from '../../lib/platformAlerts'
import { alertsToSignals, correlateAlerts } from '../../lib/alertCorrelation'
import { useAuthStore } from '../../store/authStore'
import obs from '../../components/observability/obs.module.css'
import AlertCorrelationPanel from './components/AlertCorrelationPanel'
import AlertDetailDrawer from './components/AlertDetailDrawer'
import styles from './alerts.module.css'

type Tab = 'firing' | 'silenced' | 'resolved' | 'rules' | 'channels'
type Channel = {
  id: string
  type: 'email' | 'webhook' | 'slack' | 'pagerduty'
  name: string
  url: string
  status: 'connected' | 'error'
  lastTest: string | null
}

const RULES_KEY = 'sm.alert-rules.v1'
const CHANNELS_KEY = 'sm.alert-channels.v1'

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'c-email', type: 'email', name: 'Ops email', url: '', status: 'connected', lastTest: null },
  { id: 'c-inbox', type: 'webhook', name: 'Dashboard notifications', url: '', status: 'connected', lastTest: null },
]

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function severityLevel(severity: PlatformAlert['severity']) {
  return severity === 'critical' ? 'Critical' : severity === 'info' ? 'Info' : 'Warning'
}

export default function Alerts() {
  const user = useAuthStore((s) => s.user)
  const { live, lastSyncAt, mode } = useDashboardLive(true)
  const obsQ = useObservabilityData(undefined, live)
  const promQ = usePrometheusAlerts(live)
  const queuesQ = useQueueOverview(live)
  const incidents = useIncidentPersistence()

  const [tab, setTab] = useState<Tab>('firing')
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [customRules, setCustomRules] = useState<AlertRule[]>(() => loadJson(RULES_KEY, []))
  const [channels, setChannels] = useState<Channel[]>(() => loadJson(CHANNELS_KEY, DEFAULT_CHANNELS))

  useEffect(() => localStorage.setItem(RULES_KEY, JSON.stringify(customRules)), [customRules])
  useEffect(() => localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels)), [channels])

  const rules = useMemo(() => [...BUILTIN_RULES, ...customRules], [customRules])

  const rawAlerts = useMemo(
    () =>
      buildPlatformAlerts({
        observability: obsQ.data,
        prometheus: promQ.data,
        queues: queuesQ.data,
        customRules,
      }),
    [obsQ.data, promQ.data, queuesQ.data, customRules],
  )

  const alerts = useMemo(() => {
    const live = applyIncidentState(rawAlerts, incidents.records)
    const liveIds = new Set(rawAlerts.map((a) => a.id))
    const history: PlatformAlert[] = incidents.records
      .filter((row) => row.status === 'resolved' && !liveIds.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.title || row.id,
        service: row.service || 'platform',
        severity: 'info' as const,
        condition: 'resolved',
        value: 'resolved',
        numericValue: 0,
        threshold: 0,
        source: 'apm' as const,
        startedAt: row.resolvedAt || row.updatedAt,
        relatedTraceIds: [],
        series: [0],
        status: 'resolved' as const,
        assignee: row.assignee,
        silenced: false,
        silencedUntil: null,
      }))
    return [...live, ...history]
  }, [rawAlerts, incidents.records])

  const liveFiring = useMemo(() => firingAlerts(alerts), [alerts])
  const clusters = useMemo(() => {
    const edges = (obsQ.data?.apm.serviceMap.edges ?? []) as Array<[string, string]>
    return correlateAlerts(alertsToSignals(liveFiring), edges)
  }, [liveFiring, obsQ.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return alerts.filter((alert) => {
      const matchesTab =
        tab === 'firing'
          ? alert.status !== 'resolved' && !alert.silenced
          : tab === 'silenced'
            ? alert.silenced
            : tab === 'resolved'
              ? alert.status === 'resolved'
              : true
      const matchesSev = sevFilter === 'All' || alert.severity === sevFilter.toLowerCase()
      const matchesSearch =
        !q || [alert.name, alert.service, alert.condition, alert.source].some((v) => v.toLowerCase().includes(q))
      return matchesTab && matchesSev && matchesSearch
    })
  }, [alerts, search, sevFilter, tab])

  const selected = alerts.find((a) => a.id === selectedId) ?? null

  const counts = {
    firing: liveFiring.length,
    critical: liveFiring.filter((a) => a.severity === 'critical').length,
    high: liveFiring.filter((a) => a.severity === 'high').length,
    warning: liveFiring.filter((a) => a.severity === 'warning').length,
    silenced: alerts.filter((a) => a.silenced).length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
  }

  const kpis = [
    { id: 'firing', label: 'Firing', value: counts.firing, icon: Siren, color: CC_CHART.red, trend: counts.firing ? 'up' : 'down', trendLabel: 'open' },
    { id: 'critical', label: 'Critical', value: counts.critical, icon: AlertTriangle, color: CC_CHART.red, trend: counts.critical ? 'up' : 'down', trendLabel: 'sev' },
    { id: 'high', label: 'High', value: counts.high, icon: ShieldAlert, color: CC_CHART.orange, trend: counts.high ? 'up' : 'flat', trendLabel: 'sev' },
    { id: 'warning', label: 'Warning', value: counts.warning, icon: Bell, color: CC_CHART.amber, trend: 'flat', trendLabel: 'sev' },
    { id: 'silenced', label: 'Silenced', value: counts.silenced, icon: VolumeX, color: CC_CHART.purple, trend: 'flat', trendLabel: 'muted' },
    { id: 'resolved', label: 'Resolved', value: counts.resolved, icon: CheckCircle2, color: CC_CHART.green, trend: 'down', trendLabel: 'closed' },
  ] as const

  const meta = (alert: PlatformAlert) => ({ id: alert.id, title: alert.name, service: alert.service })

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      notify.success(label)
    } catch {
      notify.error(`Failed: ${label}`)
    }
  }

  const syncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString()
    : obsQ.dataUpdatedAt
      ? new Date(obsQ.dataUpdatedAt).toLocaleTimeString()
      : '—'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Alerts</h1>
          <p className={styles.heroMeta}>
            Live Prometheus + APM + monitors · synced {syncLabel} · {mode}
          </p>
        </div>
        <div className={styles.heroActions}>
          <LiveIndicator />
          <AnimatedButton
            onClick={() => {
              void obsQ.refresh()
              void promQ.refresh()
              void queuesQ.refresh()
            }}
          >
            Refresh
          </AnimatedButton>
          <AnimatedButton onClick={() => setCreateOpen(true)}>
            <Plus size={14} style={{ marginRight: 6 }} />
            Create rule
          </AnimatedButton>
        </div>
      </header>

      <SectionHeader
        title="Alert volume"
        meta={obsQ.loading ? 'Loading telemetry…' : `${counts.firing} firing · thresholds: down · error > 1% · p99 > 1s`}
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
        {clusters.length ? (
          <div className={styles.span12}>
            <AlertCorrelationPanel clusters={clusters} />
          </div>
        ) : null}

        <div className={styles.span12}>
          <DashboardCard minHeight={420} delay={0.12}>
            <WidgetHeader
              title={tab === 'rules' ? 'Alert rules' : tab === 'channels' ? 'Notification channels' : 'Firing alerts'}
              subtitle={
                tab === 'rules'
                  ? `${rules.filter((r) => r.enabled).length} enabled`
                  : tab === 'channels'
                    ? `${channels.length} destinations`
                    : `${filtered.length} matching`
              }
              badge={<LiveIndicator />}
            />
            <WidgetToolbar
              right={(['firing', 'silenced', 'resolved', 'rules', 'channels'] as Tab[]).map((item) => (
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

            {tab === 'rules' ? (
              <RulesPanel
                rules={rules}
                onToggle={(id) => {
                  if (BUILTIN_RULES.some((r) => r.id === id)) {
                    notify.info('Built-in SLO rules stay enabled. Add a custom rule to override.')
                    return
                  }
                  setCustomRules((prev) =>
                    prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
                  )
                }}
                onDelete={(id) => setCustomRules((prev) => prev.filter((rule) => rule.id !== id))}
                onCreate={() => setCreateOpen(true)}
              />
            ) : tab === 'channels' ? (
              <ChannelsPanel
                channels={channels}
                onTest={async (channel) => {
                  try {
                    if (channel.type === 'webhook' && channel.url) {
                      await fetch(channel.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: 'MediCare System Manager test alert' }),
                      })
                    }
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                      new Notification('MediCare alert test', { body: channel.name })
                    }
                    setChannels((prev) =>
                      prev.map((c) =>
                        c.id === channel.id ? { ...c, status: 'connected', lastTest: new Date().toISOString() } : c,
                      ),
                    )
                    notify.success(`${channel.name} test sent`)
                  } catch {
                    setChannels((prev) =>
                      prev.map((c) => (c.id === channel.id ? { ...c, status: 'error', lastTest: new Date().toISOString() } : c)),
                    )
                    notify.error(`Failed to test ${channel.name}`)
                  }
                }}
                onAdd={(channel) => setChannels((prev) => [...prev, channel])}
                onDelete={(id) => setChannels((prev) => prev.filter((c) => c.id !== id))}
              />
            ) : (
              <>
                <div className={styles.toolbar}>
                  <SearchInput
                    placeholder="Search alerts, services, conditions…"
                    value={search}
                    onChange={setSearch}
                    style={{ minWidth: 240 }}
                  />
                  {(['All', 'critical', 'high', 'warning'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      className={`${obs.filterChip} ${sevFilter === sev ? obs.filterChipActive : ''}`}
                      onClick={() => setSevFilter(sev)}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
                {!filtered.length ? (
                  <EmptyState
                    title={tab === 'firing' ? 'No firing alerts' : `No ${tab} alerts`}
                    hint="Fires on service down, error rate > 1%, p99 > 1s, failed monitors, integrations, queue pressure, and Prometheus rules."
                  />
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Severity</th>
                          <th>Alert</th>
                          <th>Service</th>
                          <th>Condition</th>
                          <th>Value</th>
                          <th>Started</th>
                          <th>Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((alert) => (
                          <tr
                            key={alert.id}
                            className={alert.silenced ? styles.silenced : undefined}
                            onClick={() => setSelectedId(alert.id)}
                          >
                            <td>
                              <SeverityBadge level={severityLevel(alert.severity)} />
                            </td>
                            <td className={styles.name}>{alert.name}</td>
                            <td className={styles.mono}>{alert.service}</td>
                            <td className={styles.mono}>{alert.condition}</td>
                            <td className={styles.mono}>{alert.value}</td>
                            <td className={styles.mono}>{formatAlertAgo(alert.startedAt)}</td>
                            <td>{alert.assignee || alert.status}</td>
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
        <AlertDetailDrawer
          alert={selected}
          pending={incidents.pending}
          onClose={() => setSelectedId(null)}
          onAcknowledge={() => run('Alert acknowledged', () => incidents.acknowledge(meta(selected)))}
          onAssign={() =>
            run('Assigned to you', () =>
              incidents.assign({ ...meta(selected), assignee: user?.name || 'System Manager' }),
            )
          }
          onResolve={() => run('Alert resolved', () => incidents.resolve(meta(selected)))}
          onEscalate={() => run('Alert escalated', () => incidents.escalate(meta(selected)))}
          onSilence={(hours) => run(`Silenced for ${hours}h`, () => incidents.silence({ ...meta(selected), hours }))}
        />
      ) : null}

      {createOpen ? (
        <CreateRuleModal
          onClose={() => setCreateOpen(false)}
          onCreate={(rule) => {
            setCustomRules((prev) => [...prev, rule])
            setCreateOpen(false)
            setTab('rules')
            notify.success('Rule saved and evaluated against live telemetry')
          }}
        />
      ) : null}
    </div>
  )
}

function RulesPanel({
  rules,
  onToggle,
  onDelete,
  onCreate,
}: {
  rules: AlertRule[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.clusterMeta}>Built-in SLO rules stay on. Custom rules persist in this browser and fire from live APM.</div>
        <div style={{ flex: 1 }} />
        <AnimatedButton onClick={onCreate}>
          <Plus size={14} style={{ marginRight: 6 }} />
          Create rule
        </AnimatedButton>
      </div>
      {rules.map((rule) => (
        <div key={rule.id} className={styles.ruleRow}>
          <div>
            <div className={styles.clusterTitle}>{rule.name}</div>
            <div className={styles.mono}>
              {rule.service} · {rule.condition}
            </div>
          </div>
          <div className={styles.channelActions}>
            <SeverityBadge level={severityLevel(rule.severity)} />
            <button type="button" className={styles.ghost} onClick={() => onToggle(rule.id)}>
              {rule.enabled ? 'Enabled' : 'Disabled'}
            </button>
            {!rule.builtin ? (
              <button type="button" className={`${styles.ghost} ${styles.danger}`} onClick={() => onDelete(rule.id)}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChannelsPanel({
  channels,
  onTest,
  onAdd,
  onDelete,
}: {
  channels: Channel[]
  onTest: (channel: Channel) => void
  onAdd: (channel: Channel) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('On-call webhook')
  const [url, setUrl] = useState('')
  return (
    <div className={styles.grid}>
      {channels.map((channel) => (
        <div key={channel.id} className={styles.span6}>
          <article className={styles.channel}>
            <div className={styles.channelTop}>
              <div>
                <div className={styles.clusterTitle}>{channel.name}</div>
                <div className={styles.clusterMeta}>
                  {channel.type} · {channel.status}
                  {channel.lastTest ? ` · tested ${formatAlertAgo(channel.lastTest)}` : ''}
                </div>
              </div>
            </div>
            <div className={styles.channelActions}>
              <button type="button" className={styles.ghost} onClick={() => onTest(channel)}>
                Test
              </button>
              <button type="button" className={`${styles.ghost} ${styles.danger}`} onClick={() => onDelete(channel.id)}>
                Remove
              </button>
            </div>
          </article>
        </div>
      ))}
      <div className={styles.span12}>
        <div className={styles.toolbar}>
          <input className={styles.ghost} value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" />
          <input className={styles.ghost} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Webhook URL (optional)" style={{ minWidth: 240 }} />
          <AnimatedButton
            onClick={() => {
              onAdd({
                id: `c-${Date.now()}`,
                type: url ? 'webhook' : 'email',
                name,
                url,
                status: 'connected',
                lastTest: null,
              })
              notify.success('Channel added')
            }}
          >
            Add channel
          </AnimatedButton>
        </div>
      </div>
    </div>
  )
}

function CreateRuleModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (rule: AlertRule) => void
}) {
  const [name, setName] = useState('Custom error budget')
  const [service, setService] = useState('any')
  const [condition, setCondition] = useState('error_rate > 2')
  const [severity, setSeverity] = useState<AlertRule['severity']>('warning')

  return (
    <div className={styles.modal} onClick={onClose}>
      <form
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onCreate({
            id: `custom-${Date.now()}`,
            name,
            service,
            condition,
            severity,
            enabled: true,
            builtin: false,
            lastFired: null,
            notifications: ['email'],
          })
        }}
      >
        <h3>Create alert rule</h3>
        <div className={styles.field}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label>Service</label>
          <input value={service} onChange={(e) => setService(e.target.value)} placeholder="any or auth-service" />
        </div>
        <div className={styles.field}>
          <label>Condition</label>
          <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="error_rate > 2" />
        </div>
        <div className={styles.field}>
          <label>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as AlertRule['severity'])}>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
          </select>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onClose}>
            Cancel
          </button>
          <AnimatedButton
            onClick={() =>
              onCreate({
                id: `custom-${Date.now()}`,
                name,
                service,
                condition,
                severity,
                enabled: true,
                builtin: false,
                lastFired: null,
                notifications: ['email'],
              })
            }
          >
            Save rule
          </AnimatedButton>
        </div>
      </form>
    </div>
  )
}
