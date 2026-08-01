import StatusPill from './StatusPill'
import type { HealthTone } from '../../types/dashboard'

export default function SeverityBadge({
  level,
}: {
  level: 'Critical' | 'Warning' | 'Info' | 'Success'
}) {
  const tone: HealthTone =
    level === 'Critical'
      ? 'error'
      : level === 'Warning'
        ? 'warning'
        : level === 'Success'
          ? 'success'
          : 'info'
  return <StatusPill tone={tone}>{level}</StatusPill>
}
