import { DashboardCard, WidgetHeader } from '../components/ui'
import { PLATFORM_ACTIVITY } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export default function PlatformActivityWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Platform Activity" subtitle="Operator feed" />
      <div className={obs.scrollY} role="list" aria-label="Platform activity">
        {PLATFORM_ACTIVITY.map((a) => (
          <div key={a.id} className={obs.activityItem} role="listitem">
            <div className={obs.avatar} aria-hidden>
              {initials(a.actor)}
            </div>
            <div>
              <div className={obs.strong}>{a.action}</div>
              <div className={obs.muted}>{a.actor}</div>
            </div>
            <span className={obs.muted}>{a.ago}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}
