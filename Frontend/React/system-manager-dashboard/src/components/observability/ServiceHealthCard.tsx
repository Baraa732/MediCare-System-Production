import { HealthBadge } from '../ui'
import HealthIndicator from './HealthIndicator'
import SparklineCard from './SparklineCard'
import { CC_CHART } from '../../charts'
import styles from './obs.module.css'

export default function ServiceHealthCard({
  name,
  status,
  latencyMs,
  spark,
}: {
  name: string
  status: 'Healthy' | 'Warning' | 'Critical'
  latencyMs: number
  spark: number[]
}) {
  const color =
    status === 'Healthy'
      ? CC_CHART.green
      : status === 'Warning'
        ? CC_CHART.amber
        : CC_CHART.red

  return (
    <tr tabIndex={0}>
      <td>
        <span className={styles.row}>
          <HealthIndicator status={status} />
          <span className={styles.strong}>{name}</span>
        </span>
      </td>
      <td>
        <HealthBadge status={status} />
      </td>
      <td className={styles.latency}>{latencyMs}ms</td>
      <td className={styles.sparkCell}>
        <SparklineCard data={spark} color={color} ariaLabel={`${name} latency`} />
      </td>
    </tr>
  )
}
