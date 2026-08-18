import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Timer,
  Users,
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
import { usePlatformHealth } from '../../hooks/usePlatformHealth'
import { useQueueOverview } from '../../hooks/useQueueOverview'
import { buildLogsUrl } from '../../store/logsFilterStore'
import { QueueOverviewWidget } from '../../widgets'
import type { QueueOverviewResponse } from '../../api/types'
import { CcDrawer, CcPage } from './CcChrome'
import styles from './cc.module.css'

type QueueItem = QueueOverviewResponse['items'][number]

export default function QueuesPage() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const queuesQ = useQueueOverview(live)
  const healthQ = usePlatformHealth(live)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const items = queuesQ.data?.items ?? []
  const kafkaStatus = healthQ.health?.infrastructure.kafka ?? 'unknown'
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter])

  const selected = items.find((item) => item.name === selectedName) ?? null
  const healthy = items.filter((i) => i.status === 'Healthy').length
  const warning = items.filter((i) => i.status === 'Warning').length
  const critical = items.filter((i) => i.status === 'Critical').length
  const totalLag = items.reduce((n, i) => n + (i.lag || 0), 0)
  const totalMsgs = items.reduce((n, i) => n + (i.messages || 0), 0)
  const consumers = items.reduce((n, i) => n + (i.consumers || 0), 0)

  const kpis = [
    { id: 'topics', label: 'Topics', value: queuesQ.data?.topics ?? 0, icon: Layers, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: queuesQ.data?.source ?? 'kafka' },
    { id: 'groups', label: 'Groups', value: queuesQ.data?.groups ?? items.length, icon: Users, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: 'consumers' },
    { id: 'ok', label: 'Healthy', value: healthy, icon: CheckCircle2, color: CC_CHART.green, trend: 'up' as const, trendLabel: 'groups' },
    { id: 'warn', label: 'Warning', value: warning, icon: AlertTriangle, color: CC_CHART.amber, trend: warning ? 'up' as const : 'down' as const, trendLabel: 'lag' },
    { id: 'crit', label: 'Critical', value: critical, icon: Activity, color: CC_CHART.red, trend: critical ? 'up' as const : 'down' as const, trendLabel: 'pressure' },
    { id: 'lag', label: 'Total lag', value: totalLag, icon: Timer, color: CC_CHART.amber, trend: totalLag ? 'up' as const : 'flat' as const, trendLabel: `${consumers} consumers` },
  ]

  return (
    <CcPage
      title="Queues"
      description="Kafka admin snapshot — topics, consumer groups, and lag"
      loading={queuesQ.loading}
      onRefresh={() => {
        void queuesQ.refresh()
        void healthQ.refresh()
      }}
      kpis={kpis}
      sectionTitle="Message brokers"
      sectionMeta={
        queuesQ.data
          ? `${queuesQ.data.source ?? 'kafka'} · ${totalMsgs.toLocaleString()} messages · broker ${kafkaStatus}`
          : queuesQ.error ?? 'Waiting for Kafka admin snapshot'
      }
    >
      <div className={styles.grid}>
        <div className={styles.span12}>
          <QueueOverviewWidget
            delay={0.04}
            queues={queuesQ.data}
            onSelect={setSelectedName}
          />
        </div>

        <div className={styles.span12}>
          <DashboardCard minHeight={360} delay={0.08}>
            <WidgetHeader
              title="Consumer groups"
              subtitle={queuesQ.data?.warning ?? 'Lag and consumer counts from Kafka admin'}
            />
            <div className={styles.toolbar}>
              <SearchInput placeholder="Search groups or topics…" value={search} onChange={setSearch} />
              <FilterDropdown
                label="Status"
                value={statusFilter}
                options={['All', 'Healthy', 'Warning', 'Critical', 'Unknown']}
                onChange={setStatusFilter}
              />
            </div>
            {!filtered.length ? (
              <EmptyState
                title="No queue groups"
                hint={queuesQ.data?.warning ?? queuesQ.error ?? 'Waiting for Kafka admin snapshot.'}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Group / topic</th>
                      <th>Messages</th>
                      <th>Consumers</th>
                      <th>Lag</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.name}
                        className={selectedName === item.name ? styles.selected : undefined}
                        onClick={() => setSelectedName(item.name)}
                      >
                        <td className={styles.name}>{item.name}</td>
                        <td className={styles.mono}>{item.messages.toLocaleString()}</td>
                        <td className={styles.mono}>{item.consumers}</td>
                        <td className={item.lag > 0 ? styles.error : styles.mono}>{item.lag.toLocaleString()}</td>
                        <td>
                          <HealthBadge status={item.status === 'Unknown' ? 'Warning' : item.status} />
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
        <QueueDrawer
          item={selected}
          kafkaStatus={kafkaStatus}
          onClose={() => setSelectedName(null)}
          onInfra={() => navigate('/cc/infrastructure')}
          onAlerts={() => navigate('/alerts')}
          onLogs={() => navigate(buildLogsUrl({ search: selected.name }))}
        />
      ) : null}
    </CcPage>
  )
}

function QueueDrawer({
  item,
  kafkaStatus,
  onClose,
  onInfra,
  onAlerts,
  onLogs,
}: {
  item: QueueItem
  kafkaStatus: string
  onClose: () => void
  onInfra: () => void
  onAlerts: () => void
  onLogs: () => void
}) {
  const stressed = item.status === 'Warning' || item.status === 'Critical'
  return (
    <CcDrawer
      title={item.name}
      subtitle="Kafka consumer group / topic"
      badge={<HealthBadge status={item.status === 'Unknown' ? 'Warning' : item.status} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Status', item.status],
          ['Messages', item.messages.toLocaleString()],
          ['Consumers', String(item.consumers)],
          ['Lag', item.lag.toLocaleString()],
          ['Broker probe', kafkaStatus],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.drawerSub}>
        {stressed
          ? 'Lag or consumer pressure is above the healthy threshold. Open Alerts for firing queue rules.'
          : 'Group is within the healthy lag window from the Kafka admin snapshot.'}
      </div>
      <div className={styles.actions}>
        <AnimatedButton onClick={onLogs}>Search logs</AnimatedButton>
        <AnimatedButton onClick={onInfra}>Open infrastructure</AnimatedButton>
        {stressed ? <AnimatedButton onClick={onAlerts}>Open alerts</AnimatedButton> : null}
      </div>
    </CcDrawer>
  )
}
