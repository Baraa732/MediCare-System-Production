import { DashboardCard, WidgetHeader, EmptyState, HealthBadge } from '../components/ui'
import type { PlatformHealth } from '../api/types'
import obs from '../components/observability/obs.module.css'

function tone(status: string): 'Healthy' | 'Warning' | 'Critical' {
  if (status === 'ok') return 'Healthy'
  if (status === 'unknown') return 'Warning'
  return 'Critical'
}

export default function DatabaseOverviewWidget({
  delay = 0,
  health,
}: {
  delay?: number
  health?: PlatformHealth | null
}) {
  const infra = health?.infrastructure
  const cards = infra
    ? [
        { name: 'PostgreSQL', status: tone(infra.database), detail: infra.database },
        { name: 'Redis', status: tone(infra.redis), detail: infra.redis },
        { name: 'Kafka', status: tone(infra.kafka), detail: infra.kafka },
      ]
    : []

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Database Overview" subtitle="Infrastructure probes" />
      {!cards.length ? (
        <EmptyState title="Health unavailable" />
      ) : (
        <div className={obs.miniGrid}>
          {cards.map((c) => (
            <article key={c.name} className={obs.dbCard} tabIndex={0}>
              <div className={obs.rowBetween}>
                <div className={obs.dbName}>{c.name}</div>
                <HealthBadge status={c.status} />
              </div>
              <div className={obs.muted}>check · {c.detail}</div>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
