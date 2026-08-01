import { useMemo } from 'react'
import { ChartCard, LiveIndicator } from '../components/observability'
import { areaDualOption, CC_CHART } from '../charts'
import { NETWORK_TRAFFIC } from '../constants/overviewData'

export default function NetworkTrafficWidget({ delay = 0 }: { delay?: number }) {
  const option = useMemo(
    () =>
      areaDualOption({
        labels: NETWORK_TRAFFIC.labels,
        a: {
          name: 'Ingress',
          data: NETWORK_TRAFFIC.ingress,
          color: CC_CHART.cyan,
        },
        b: {
          name: 'Egress',
          data: NETWORK_TRAFFIC.egress,
          color: CC_CHART.purple,
        },
      }),
    [],
  )

  return (
    <ChartCard
      title="Network Traffic"
      subtitle="Bandwidth Mb/s"
      badge={<LiveIndicator />}
      option={option}
      height={180}
      delay={delay}
      minHeight={280}
      ariaLabel="Network traffic bandwidth"
    />
  )
}
