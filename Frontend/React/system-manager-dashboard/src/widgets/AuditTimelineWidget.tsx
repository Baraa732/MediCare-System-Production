import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { AuditCard } from '../components/observability'
import type { SecuritySummary } from '../api/types'
import obs from '../components/observability/obs.module.css'

export default function AuditTimelineWidget({
  delay = 0,
  security,
}: {
  delay?: number
  security?: SecuritySummary | null
}) {
  const items = security?.recentAudits ?? []
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Audit Timeline" subtitle="Access & governance" />
      {!items.length ? (
        <EmptyState title="No audit events" />
      ) : (
        <div className={`${obs.stack} ${obs.scrollY}`}>
          {items.slice(0, 12).map((a) => (
            <AuditCard
              key={a.id}
              actor={a.actor}
              action={a.action}
              target={a.target}
              ago={a.ago}
              result={a.result}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
