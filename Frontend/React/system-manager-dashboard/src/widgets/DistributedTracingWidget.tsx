import { DashboardCard, WidgetHeader } from '../components/ui'
import { TracingGraph } from '../components/observability'
import { TRACE_EDGES, TRACE_NODES } from '../constants/overviewData'

export default function DistributedTracingWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Distributed Tracing"
        subtitle="Request path · latency labels"
      />
      <TracingGraph nodes={[...TRACE_NODES]} edges={TRACE_EDGES} />
    </DashboardCard>
  )
}
