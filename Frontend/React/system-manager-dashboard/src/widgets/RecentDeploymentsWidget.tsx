import { DashboardCard, WidgetHeader } from '../components/ui'
import { DeploymentCard } from '../components/observability'
import { DEPLOYMENTS } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function RecentDeploymentsWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Recent Deployments" subtitle="CI / CD pipeline" />
      <div className={obs.scrollY} role="list" aria-label="Recent deployments">
        {DEPLOYMENTS.map((d) => (
          <div key={d.id} role="listitem">
            <DeploymentCard {...d} />
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}
