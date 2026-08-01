import { DashboardCard, WidgetHeader } from '../components/ui'
import { QueueCard } from '../components/observability'
import { QUEUES } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function QueueOverviewWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Queue Overview" subtitle="Messages · consumers · lag" />
      <div className={obs.miniGrid}>
        {QUEUES.map((q) => (
          <QueueCard key={q.name} {...q} />
        ))}
      </div>
    </DashboardCard>
  )
}
