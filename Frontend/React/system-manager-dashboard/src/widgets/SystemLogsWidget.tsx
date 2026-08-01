import { DashboardCard, WidgetHeader } from '../components/ui'
import { LogsTable } from '../components/observability'
import { SYSTEM_LOGS } from '../constants/overviewData'

export default function SystemLogsWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="System Logs" subtitle="Structured stream · static sample" />
      <LogsTable logs={[...SYSTEM_LOGS]} />
    </DashboardCard>
  )
}
