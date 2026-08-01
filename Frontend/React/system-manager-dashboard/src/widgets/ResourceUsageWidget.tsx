import { useMemo } from 'react'
import { ChartCard } from '../components/observability'
import { LiveIndicator } from '../components/observability'
import { multiLineOption, CC_CHART } from '../charts'
import { RESOURCE_USAGE } from '../constants/overviewData'

export default function ResourceUsageWidget({ delay = 0 }: { delay?: number }) {
  const option = useMemo(
    () =>
      multiLineOption({
        labels: RESOURCE_USAGE.labels,
        series: [
          { name: 'CPU', data: RESOURCE_USAGE.cpu, color: CC_CHART.cyan },
          { name: 'Memory', data: RESOURCE_USAGE.memory, color: CC_CHART.purple },
          { name: 'Disk', data: RESOURCE_USAGE.disk, color: CC_CHART.amber },
          { name: 'Network', data: RESOURCE_USAGE.network, color: CC_CHART.green },
        ],
      }),
    [],
  )

  return (
    <ChartCard
      title="Resource Usage"
      subtitle="24h utilization"
      badge={<LiveIndicator />}
      option={option}
      height={200}
      delay={delay}
      minHeight={280}
      ariaLabel="Resource usage multi-line chart"
    />
  )
}
