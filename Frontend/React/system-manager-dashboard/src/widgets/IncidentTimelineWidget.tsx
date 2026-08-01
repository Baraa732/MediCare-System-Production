import { DashboardCard, WidgetHeader } from '../components/ui'
import { SeverityBadge, TimelineCard } from '../components/observability'
import { INCIDENT_TIMELINE } from '../constants/overviewData'

export default function IncidentTimelineWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Incident Timeline" subtitle="Severity chronology" />
      <TimelineCard
        items={INCIDENT_TIMELINE.map((i) => ({
          id: i.id,
          title: i.title,
          meta: `Duration ${i.duration}`,
          ago: i.ago,
          tone:
            i.severity === 'Critical'
              ? 'error'
              : i.severity === 'Warning'
                ? 'warning'
                : 'info',
          badge: <SeverityBadge level={i.severity} />,
        }))}
      />
    </DashboardCard>
  )
}
