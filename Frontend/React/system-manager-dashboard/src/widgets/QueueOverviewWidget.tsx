import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { QueueCard } from '../components/observability'
import type { QueueOverviewResponse } from '../api/types'
import obs from '../components/observability/obs.module.css'

export default function QueueOverviewWidget({
  delay = 0,
  queues,
}: {
  delay?: number
  queues?: QueueOverviewResponse | null
}) {
  const items = queues?.items ?? []
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Queue Overview" subtitle="Lag · outbox · Kafka" />
      {!items.length ? (
        <EmptyState
          title="No queue metrics"
          hint={queues?.warning ?? 'Prometheus lag series not exported yet.'}
        />
      ) : (
        <div className={obs.miniGrid}>
          {items.map((q) => (
            <QueueCard
              key={q.name}
              name={q.name}
              messages={q.messages}
              consumers={q.consumers}
              lag={q.lag}
              status={q.status === 'Unknown' ? 'Warning' : q.status}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
