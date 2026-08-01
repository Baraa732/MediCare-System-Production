import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { SeverityBadge, TimelineCard } from '../components/observability'
import type { PlatformIncidentRecord } from '../api/types'

export default function IncidentTimelineWidget({
  delay = 0,
  incidents = [],
}: {
  delay?: number
  incidents?: PlatformIncidentRecord[]
}) {
  const items = incidents.slice(0, 10).map((i) => ({
    id: i.id,
    title: i.title || `Incident ${i.id.slice(0, 8)}`,
    meta: i.service || i.status,
    ago: i.updatedAt,
    tone:
      i.status === 'escalated'
        ? ('error' as const)
        : i.status === 'resolved'
          ? ('success' as const)
          : ('warning' as const),
    badge: (
      <SeverityBadge
        level={
          i.status === 'escalated'
            ? 'Critical'
            : i.status === 'resolved'
              ? 'Success'
              : 'Warning'
        }
      />
    ),
  }))

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Incident Timeline" subtitle="Persisted incidents" />
      {!items.length ? (
        <EmptyState title="No incidents" />
      ) : (
        <TimelineCard items={items} />
      )}
    </DashboardCard>
  )
}
