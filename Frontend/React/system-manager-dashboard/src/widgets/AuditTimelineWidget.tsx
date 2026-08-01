import { DashboardCard, WidgetHeader } from '../components/ui'
import { AuditCard } from '../components/observability'
import { AUDIT_TIMELINE } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function AuditTimelineWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Audit Timeline" subtitle="Access & governance" />
      <div className={`${obs.stack} ${obs.scrollY}`}>
        {AUDIT_TIMELINE.map((a) => (
          <AuditCard key={a.id} {...a} />
        ))}
      </div>
    </DashboardCard>
  )
}
