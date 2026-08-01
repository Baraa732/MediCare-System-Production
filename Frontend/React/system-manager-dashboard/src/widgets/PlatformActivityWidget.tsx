import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import type { SecuritySummary } from '../api/types'
import obs from '../components/observability/obs.module.css'

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export default function PlatformActivityWidget({
  delay = 0,
  security,
}: {
  delay?: number
  security?: SecuritySummary | null
}) {
  const items = security?.recentAudits ?? []
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Platform Activity" subtitle="Audit feed" />
      {!items.length ? (
        <EmptyState title="No audit activity" hint="Auth audit trail empty for range." />
      ) : (
        <div className={obs.scrollY} role="list" aria-label="Platform activity">
          {items.slice(0, 12).map((a) => (
            <div key={a.id} className={obs.activityItem} role="listitem">
              <div className={obs.avatar} aria-hidden>
                {initials(a.actor)}
              </div>
              <div>
                <div className={obs.strong}>{a.action}</div>
                <div className={obs.muted}>
                  {a.actor} · {a.target}
                </div>
              </div>
              <span className={obs.muted}>{a.ago}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
