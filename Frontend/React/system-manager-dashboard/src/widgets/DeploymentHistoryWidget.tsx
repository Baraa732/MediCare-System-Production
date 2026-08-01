import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { SeverityBadge, TimelineCard } from '../components/observability'
import type { DeploymentsResponse } from '../api/types'

export default function DeploymentHistoryWidget({
  delay = 0,
  deployments,
}: {
  delay?: number
  deployments?: DeploymentsResponse | null
}) {
  const items = (deployments?.items ?? []).map((d) => ({
    id: d.id,
    title: `${d.service} ${d.version}`,
    ago: d.ago,
    tone: d.status === 'Success' ? ('success' as const) : ('warning' as const),
    badge: (
      <SeverityBadge level={d.status === 'Success' ? 'Success' : 'Warning'} />
    ),
  }))

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Deployment History" subtitle="Release timeline" />
      {!deployments?.available || !items.length ? (
        <EmptyState title="No deployment history" hint={deployments?.warning} />
      ) : (
        <TimelineCard items={items} />
      )}
    </DashboardCard>
  )
}
