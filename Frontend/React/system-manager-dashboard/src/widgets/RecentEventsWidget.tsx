import { DashboardCard, WidgetHeader } from '../components/ui'
import { TimelineCard } from '../components/observability'
import { RECENT_EVENTS } from '../constants/overviewData'

export default function RecentEventsWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Recent Events" subtitle="Platform signals" />
      <TimelineCard
        items={RECENT_EVENTS.map((e) => ({
          id: e.id,
          title: e.title,
          meta: e.detail,
          ago: e.ago,
          tone: e.tone,
        }))}
      />
    </DashboardCard>
  )
}
