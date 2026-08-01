import { useMemo, useState } from 'react'
import { DashboardCard, WidgetHeader } from '../components/ui'
import {
  AlertCard,
  LiveIndicator,
  WidgetToolbar,
} from '../components/observability'
import { ACTIVE_ALERTS } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

type Filter = 'All' | 'Critical' | 'Warning' | 'Info'

export default function ActiveAlertsWidget({ delay = 0 }: { delay?: number }) {
  const [filter, setFilter] = useState<Filter>('All')
  const items = useMemo(
    () =>
      filter === 'All'
        ? ACTIVE_ALERTS
        : ACTIVE_ALERTS.filter((a) => a.level === filter),
    [filter],
  )

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Active Alerts"
        subtitle={`${ACTIVE_ALERTS.length} open`}
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
      <div className={obs.alertList} role="list" aria-label="Active alerts">
        {items.map((a) => (
          <div key={a.id} role="listitem">
            <AlertCard {...a} />
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}
