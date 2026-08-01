import { DashboardCard, WidgetHeader } from '../components/ui'
import { DatabaseStatusCard } from '../components/observability'
import { DATABASES } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function DatabaseOverviewWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Database Overview" subtitle="Health · latency · storage" />
      <div className={obs.miniGrid}>
        {DATABASES.map((db) => (
          <DatabaseStatusCard key={db.name} {...db} />
        ))}
      </div>
    </DashboardCard>
  )
}
