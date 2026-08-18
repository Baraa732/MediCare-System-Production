import { DashboardCard, WidgetHeader } from '../components/ui'
import { LiveIndicator, SeverityBadge, TimelineCard } from '../components/observability'
import type { IncidentTimelineItem } from '../pages/control-center/overviewModel'

export default function IncidentTimelineWidget({
  delay = 0,
  items = [],
}: {
  delay?: number
  items?: IncidentTimelineItem[]
}) {
  const rows = items.slice(0, 10).map((i) => ({
    id: i.id,
    title: i.title,
    meta: i.meta,
    ago: i.ago,
    tone:
      i.level === 'Critical'
        ? ('error' as const)
        : i.level === 'Success'
          ? ('success' as const)
          : i.level === 'Warning'
            ? ('warning' as const)
            : ('info' as const),
    badge: <SeverityBadge level={i.level} />,
  }))

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Incident Timeline"
        subtitle={items.length ? `${items.length} events` : 'Live + persisted'}
        badge={<LiveIndicator />}
      />
      <TimelineCard items={rows} />
    </DashboardCard>
  )
}
