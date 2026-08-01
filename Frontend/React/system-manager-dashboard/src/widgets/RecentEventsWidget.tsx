import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { TimelineCard } from '../components/observability'
import type { PlatformIncidentRecord } from '../api/types'
import type { PlatformLogsResponse } from '../api/types'

export default function RecentEventsWidget({
  delay = 0,
  incidents = [],
  logs,
}: {
  delay?: number
  incidents?: PlatformIncidentRecord[]
  logs?: PlatformLogsResponse | null
}) {
  const items = [
    ...incidents.slice(0, 4).map((i) => ({
      id: i.id,
      title: i.title || 'Incident update',
      meta: i.service || i.status,
      ago: i.updatedAt,
      tone:
        i.status === 'resolved'
          ? ('success' as const)
          : i.status === 'escalated'
            ? ('error' as const)
            : ('warning' as const),
    })),
    ...(logs?.entries ?? [])
      .filter((e) => e.level === 'ERROR' || e.level === 'WARN')
      .slice(0, 4)
      .map((e) => ({
        id: e.id,
        title: e.message.slice(0, 60),
        meta: e.service,
        ago: e.timestamp,
        tone: e.level === 'ERROR' ? ('error' as const) : ('warning' as const),
      })),
  ].slice(0, 8)

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Recent Events" subtitle="Incidents · warnings" />
      {!items.length ? (
        <EmptyState title="No recent events" />
      ) : (
        <TimelineCard items={items} />
      )}
    </DashboardCard>
  )
}
