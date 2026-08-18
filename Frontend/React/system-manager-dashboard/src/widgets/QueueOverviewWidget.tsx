import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { LiveIndicator, QueueCard } from '../components/observability'
import type { QueueOverviewResponse } from '../api/types'
import obs from '../components/observability/obs.module.css'

export default function QueueOverviewWidget({
  delay = 0,
  queues,
  onSelect,
}: {
  delay?: number
  queues?: QueueOverviewResponse | null
  onSelect?: (name: string) => void
}) {
  const items = queues?.items ?? []
  const topicCount = queues?.topics ?? 0
  const groupCount = queues?.groups ?? 0
  const subtitle =
    topicCount || groupCount
      ? `${topicCount} topics · ${groupCount} groups`
      : queues?.source
        ? `via ${queues.source}`
        : 'Lag · outbox · Kafka'

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Queue Overview"
        subtitle={subtitle}
        badge={<LiveIndicator />}
      />
      {!items.length ? (
        <EmptyState
          title="No queue metrics"
          hint={queues?.warning ?? 'Waiting for Kafka admin snapshot.'}
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
              onClick={onSelect ? () => onSelect(q.name) : undefined}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
