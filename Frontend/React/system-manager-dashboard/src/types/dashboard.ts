import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type HealthTone = 'success' | 'warning' | 'error' | 'info' | 'muted'
export type TrendDirection = 'up' | 'down' | 'flat'

export interface KpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trendLabel?: string
  trend?: TrendDirection
  live?: boolean
  delay?: number
}

export interface WidgetHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  badge?: ReactNode
}

export interface DashboardCardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  span?: number
  delay?: number
  minHeight?: number | string
}

export interface NavBadge {
  label: string
  tone?: HealthTone
}

export interface ControlNavItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: NavBadge
}

export interface ControlNavSection {
  id: string
  label: string
  items: ControlNavItem[]
}
