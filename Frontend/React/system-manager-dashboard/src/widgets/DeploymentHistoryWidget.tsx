import { DashboardCard, WidgetHeader } from '../components/ui'
import { SeverityBadge, TimelineCard } from '../components/observability'
import { DEPLOY_HISTORY } from '../constants/overviewData'

export default function DeploymentHistoryWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Deployment History" subtitle="Release timeline" />
      <TimelineCard
        items={DEPLOY_HISTORY.map((d) => ({
          id: d.id,
          title: `${d.service} ${d.version}`,
          ago: d.ago,
          tone: d.status === 'Success' ? 'success' : 'warning',
          badge: (
            <SeverityBadge level={d.status === 'Success' ? 'Success' : 'Warning'} />
          ),
        }))}
      />
    </DashboardCard>
  )
}
