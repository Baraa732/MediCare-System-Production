import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { GaugeCard, LiveIndicator } from '../components/observability'

export default function LiveSystemLoadWidget({
  delay = 0,
  load,
}: {
  delay?: number
  load?: {
    overall: number
    cpu: number
    memory: number
    disk: number | null
    network: number | null
    available: boolean
  }
}) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Live System Load"
        subtitle="CPU · memory from APM"
        badge={<LiveIndicator />}
      />
      {!load?.available ? (
        <EmptyState
          title="Resource metrics unavailable"
          hint="CPU/memory appear when Prometheus scrapes process_* series."
        />
      ) : (
        <GaugeCard
          overall={load.overall}
          cpu={load.cpu}
          memory={load.memory}
          disk={load.disk ?? 0}
          network={load.network ?? 0}
        />
      )}
    </DashboardCard>
  )
}
