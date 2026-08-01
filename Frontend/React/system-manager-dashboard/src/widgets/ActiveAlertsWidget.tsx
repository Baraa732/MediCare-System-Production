import { useMemo, useState } from 'react'
import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { AlertCard, LiveIndicator, WidgetToolbar } from '../components/observability'
import obs from '../components/observability/obs.module.css'

type Filter = 'All' | 'Critical' | 'Warning' | 'Info'
type AlertItem = {
  id: string
  title: string
  service: string
  level: 'Critical' | 'Warning' | 'Info'
  ago: string
}

export default function ActiveAlertsWidget({
  delay = 0,
  alerts = [],
}: {
  delay?: number
  alerts?: AlertItem[]
}) {
  const [filter, setFilter] = useState<Filter>('All')
  const items = useMemo(
    () => (filter === 'All' ? alerts : alerts.filter((a) => a.level === filter)),
    [alerts, filter],
  )

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Active Alerts"
        subtitle={`${alerts.length} open`}
        badge={<LiveIndicator />}
      />
      <WidgetToolbar
        right={(['All', 'Critical', 'Warning', 'Info'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`${obs.filterChip} ${filter === f ? obs.filterChipActive : ''}`}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {f}
          </button>
        ))}
      />
      {!items.length ? (
        <EmptyState title="No active alerts" hint="Incidents and degraded services appear here." />
      ) : (
        <div className={obs.alertList} role="list" aria-label="Active alerts">
          {items.map((a) => (
            <div key={a.id} role="listitem">
              <AlertCard {...a} />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
