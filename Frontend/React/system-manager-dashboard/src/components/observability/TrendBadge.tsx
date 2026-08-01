import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { TrendDirection } from '../../types/dashboard'
import styles from '../ui/ui.module.css'

export default function TrendBadge({
  trend,
  label,
}: {
  trend: TrendDirection
  label: string
}) {
  const Icon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  const cls =
    trend === 'up'
      ? styles.trendUp
      : trend === 'down'
        ? styles.trendDown
        : styles.trendFlat
  return (
    <span className={cls}>
      <Icon size={12} aria-hidden /> {label}
    </span>
  )
}
