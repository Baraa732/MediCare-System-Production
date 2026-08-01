import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { DeploymentCard } from '../components/observability'
import type { DeploymentsResponse } from '../api/types'
import obs from '../components/observability/obs.module.css'

export default function RecentDeploymentsWidget({
  delay = 0,
  deployments,
}: {
  delay?: number
  deployments?: DeploymentsResponse | null
}) {
  const items = deployments?.items ?? []
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Recent Deployments" subtitle={deployments?.source ?? '—'} />
      {!deployments?.available || !items.length ? (
        <EmptyState
          title="No deployments recorded"
          hint={deployments?.warning ?? 'CI webhook → POST /internal/deployments'}
        />
      ) : (
        <div className={obs.scrollY} role="list" aria-label="Recent deployments">
          {items.map((d) => (
            <div key={d.id} role="listitem">
              <DeploymentCard
                service={d.service}
                version={d.version}
                by={d.by}
                ago={d.ago}
                status={d.status === 'Rolled back' ? 'Rolled back' : 'Success'}
                duration={d.duration}
              />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
