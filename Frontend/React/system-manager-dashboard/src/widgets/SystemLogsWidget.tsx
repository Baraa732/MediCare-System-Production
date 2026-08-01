import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { LogsTable } from '../components/observability'
import { mapLogEntries } from '../pages/control-center/overviewModel'
import type { PlatformLogsResponse } from '../api/types'

export default function SystemLogsWidget({
  delay = 0,
  logs,
}: {
  delay?: number
  logs?: PlatformLogsResponse | null
}) {
  const rows = mapLogEntries(logs ?? null)
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="System Logs"
        subtitle={logs?.source ? `Source · ${logs.source}` : 'Live stream'}
      />
      {!rows.length ? (
        <EmptyState title="No log entries" hint={logs?.warning ?? 'Loki/docker feed empty for range.'} />
      ) : (
        <LogsTable logs={rows} />
      )}
    </DashboardCard>
  )
}
