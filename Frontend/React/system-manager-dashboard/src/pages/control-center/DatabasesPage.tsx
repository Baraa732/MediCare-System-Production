import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Server,
  ShieldAlert,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  EmptyState,
  HealthBadge,
  SearchInput,
  WidgetHeader,
} from '../../components/ui'
import { CC_CHART } from '../../charts'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { usePlatformHealth } from '../../hooks/usePlatformHealth'
import { buildLogsUrl } from '../../store/logsFilterStore'
import { DatabaseOverviewWidget } from '../../widgets'
import type { PlatformHealth } from '../../api/types'
import { CcDrawer, CcPage, healthTone } from './CcChrome'
import styles from './cc.module.css'

type DatastoreId = 'postgres' | 'redis'
type Dependent = { service: string; check: string; status: string }
type Datastore = {
  id: DatastoreId
  name: string
  engine: string
  role: string
  status: 'ok' | 'error' | 'unknown'
  dependents: Dependent[]
}

function checkKind(key: string): DatastoreId | null {
  const value = key.toLowerCase()
  if (value.includes('redis')) return 'redis'
  if (/(db|postgres|database|sql)/.test(value)) return 'postgres'
  return null
}

function buildDatastores(health: PlatformHealth | null): Datastore[] {
  const infra = health?.infrastructure
  const postgres: Datastore = {
    id: 'postgres',
    name: 'PostgreSQL',
    engine: 'PostgreSQL',
    role: 'Primary datastore',
    status: infra?.database ?? 'unknown',
    dependents: [],
  }
  const redis: Datastore = {
    id: 'redis',
    name: 'Redis',
    engine: 'Redis',
    role: 'Cache / sessions',
    status: infra?.redis ?? 'unknown',
    dependents: [],
  }

  for (const service of health?.services ?? []) {
    for (const [check, status] of Object.entries(service.checks ?? {})) {
      const kind = checkKind(check)
      if (kind === 'postgres') postgres.dependents.push({ service: service.name, check, status })
      if (kind === 'redis') redis.dependents.push({ service: service.name, check, status })
    }
  }

  return [postgres, redis]
}

export default function DatabasesPage() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const healthQ = usePlatformHealth(live)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<DatastoreId | null>(null)

  const stores = useMemo(() => buildDatastores(healthQ.health), [healthQ.health])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stores.filter((s) => !q || s.name.toLowerCase().includes(q) || s.engine.toLowerCase().includes(q))
  }, [search, stores])

  const selected = stores.find((s) => s.id === selectedId) ?? null
  const ok = stores.filter((s) => s.status === 'ok').length
  const failed = stores.filter((s) => s.status === 'error').length
  const unknown = stores.filter((s) => s.status === 'unknown').length
  const dependents = stores.reduce((n, s) => n + s.dependents.length, 0)
  const failingDeps = stores.flatMap((s) => s.dependents.filter((d) => healthTone(d.status) === 'Critical'))

  const kpis = [
    { id: 'stores', label: 'Datastores', value: stores.length, icon: Database, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: 'probed' },
    { id: 'ok', label: 'Healthy', value: ok, icon: CheckCircle2, color: CC_CHART.green, trend: ok === stores.length ? 'up' as const : 'down' as const, trendLabel: 'infra' },
    { id: 'fail', label: 'Failed', value: failed, icon: AlertTriangle, color: CC_CHART.red, trend: failed ? 'up' as const : 'down' as const, trendLabel: 'probes' },
    { id: 'unk', label: 'Unknown', value: unknown, icon: ShieldAlert, color: CC_CHART.amber, trend: 'flat' as const, trendLabel: 'checks' },
    { id: 'deps', label: 'Dependents', value: dependents, icon: Server, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: 'services' },
    { id: 'broken', label: 'Failing deps', value: failingDeps.length, icon: HardDrive, color: CC_CHART.red, trend: failingDeps.length ? 'up' as const : 'down' as const, trendLabel: 'checks' },
  ]

  return (
    <CcPage
      title="Databases"
      description="Live PostgreSQL and Redis probes from platform health"
      loading={healthQ.loading}
      onRefresh={() => void healthQ.refresh()}
      kpis={kpis}
      sectionTitle="Datastore estate"
      sectionMeta={healthQ.health ? `${ok}/${stores.length} healthy · Kafka belongs on Queues` : 'Waiting for health probes'}
    >
      <div className={styles.grid}>
        <div className={styles.span6}>
          <DatabaseOverviewWidget
            delay={0.04}
            health={healthQ.health}
            onSelect={(name) => {
              if (name === 'Kafka') {
                navigate('/cc/queues')
                return
              }
              setSelectedId(name === 'Redis' ? 'redis' : 'postgres')
            }}
          />
        </div>
        <div className={styles.span6}>
          <DashboardCard minHeight={280} delay={0.08}>
            <WidgetHeader title="Dependent services" subtitle="Nested database / redis checks" />
            {!failingDeps.length && dependents ? (
              <EmptyState title="All datastore checks passing" hint={`${dependents} service checks reported.`} />
            ) : !dependents ? (
              <EmptyState title="No nested datastore checks" hint="Waiting for service health payloads." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Check</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failingDeps.map((d) => (
                      <tr key={`${d.service}-${d.check}`} onClick={() => navigate(buildLogsUrl({ services: [d.service] }))}>
                        <td className={styles.name}>{d.service}</td>
                        <td className={styles.mono}>{d.check}</td>
                        <td><HealthBadge status={healthTone(d.status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>

        <div className={styles.span12}>
          <DashboardCard minHeight={320} delay={0.1}>
            <WidgetHeader title="Datastores" subtitle="Click a row for dependents and actions" />
            <div className={styles.toolbar}>
              <SearchInput placeholder="Search datastores…" value={search} onChange={setSearch} />
            </div>
            {!filtered.length ? (
              <EmptyState title="No datastores" hint={healthQ.error ?? 'Health feed is empty.'} />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Engine</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Dependents</th>
                      <th>Failing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((store) => {
                      const failCount = store.dependents.filter((d) => healthTone(d.status) === 'Critical').length
                      return (
                        <tr
                          key={store.id}
                          className={selectedId === store.id ? styles.selected : undefined}
                          onClick={() => setSelectedId(store.id)}
                        >
                          <td className={styles.name}>{store.name}</td>
                          <td className={styles.mono}>{store.engine}</td>
                          <td>{store.role}</td>
                          <td><HealthBadge status={healthTone(store.status)} /></td>
                          <td className={styles.mono}>{store.dependents.length}</td>
                          <td className={failCount ? styles.error : styles.mono}>{failCount}</td>
                        </tr>
                      )
                    })}
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
          subtitle={`${selected.engine} · ${selected.role}`}
          badge={<HealthBadge status={healthTone(selected.status)} />}
          onClose={() => setSelectedId(null)}
        >
          <dl>
            {[
              ['Engine', selected.engine],
              ['Infra probe', selected.status],
              ['Dependents', String(selected.dependents.length)],
              ['Failing checks', String(selected.dependents.filter((d) => healthTone(d.status) === 'Critical').length)],
            ].map(([k, v]) => (
              <div key={k} className={styles.kv}>
                <dt>{k}</dt>
                <dd className={styles.mono}>{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <div className={styles.drawerSub}>Services depending on this store</div>
            <div className={styles.checkList}>
              {selected.dependents.length ? (
                selected.dependents.map((d) => (
                  <div key={`${d.service}-${d.check}`} className={styles.check}>
                    <span>{d.service} · {d.check}</span>
                    <HealthBadge status={healthTone(d.status)} />
                  </div>
                ))
              ) : (
                <div className={styles.drawerSub}>No nested checks reported for this datastore.</div>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            {selected.dependents[0] ? (
              <AnimatedButton onClick={() => navigate(buildLogsUrl({ services: [selected.dependents[0].service] }))}>
                Open dependent logs
              </AnimatedButton>
            ) : null}
            <AnimatedButton onClick={() => navigate('/cc/infrastructure')}>Open infrastructure</AnimatedButton>
            {failingDeps.length ? (
              <AnimatedButton onClick={() => navigate('/alerts')}>Open alerts</AnimatedButton>
            ) : null}
          </div>
        </CcDrawer>
      ) : null}
    </CcPage>
  )
}
