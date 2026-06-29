import type { ReactNode } from 'react'
import { Box, Button, Chip, Grid, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import type { LucideIcon } from 'lucide-react'

interface ObservabilityPageProps {
  children: ReactNode
  fill?: boolean
  sx?: SxProps<Theme>
}

/** Page shell for observability views. Use `fill` only when a single inner panel should consume remaining viewport height. */
export function ObservabilityPage({ children, fill = false, sx }: ObservabilityPageProps) {
  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minHeight: 'calc(100vh - 80px)',
        ...(fill
          ? {
              height: 'calc(100vh - 80px)',
              maxHeight: 'calc(100vh - 80px)',
              overflow: 'hidden',
              minHeight: 0,
            }
          : {
              overflow: 'visible',
              pb: 2,
            }),
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/** PBI-style responsive grid row with consistent spacing. */
export function PbiGrid({ children, spacing = 1.5 }: { children: ReactNode; spacing?: number }) {
  return (
    <Grid container spacing={spacing} sx={{ width: '100%', flexShrink: 0 }}>
      {children}
    </Grid>
  )
}

interface AdvancedPageHeaderProps {
  title: string
  eyebrow?: string
  description: string
  icon?: LucideIcon
  color?: string
  status?: string
  actions?: ReactNode
  children?: ReactNode
  compact?: boolean
}

export function AdvancedPageHeader({
  title,
  eyebrow = 'MediCare Admin',
  description,
  icon: Icon,
  color = '#06b6d4',
  status = 'Live',
  actions,
  children,
  compact = false,
}: AdvancedPageHeaderProps) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        flexShrink: 0,
        p: compact ? 1.5 : 2,
        borderRadius: '5px',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
        {Icon && (
          <Box sx={{ width: 36, height: 36, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(color, 0.1), color }}>
            <Icon size={18} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{eyebrow}</Typography>
            <Chip label={status} size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha(color, 0.12), color }} />
          </Box>
          <Typography variant="h2" sx={{ fontSize: compact ? 20 : undefined }}>{title}</Typography>
          {!compact && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 900 }}>
              {description}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>}
      </Box>
      {children && <Box sx={{ mt: 1.5 }}>{children}</Box>}
    </Box>
  )
}

interface CommandMetricProps {
  label: string
  value: ReactNode
  helper?: string
  color?: string
  icon?: LucideIcon
}

export function CommandMetric({ label, value, helper, color = '#06b6d4', icon: Icon }: CommandMetricProps) {
  return (
    <Box
      sx={{
        p: 1.25,
        minHeight: 72,
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: '4px',
        bgcolor: alpha(color, 0.05),
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
        {Icon && <Icon size={14} color={color} />}
      </Box>
      <Typography variant="metricSm" sx={{ display: 'block', mt: 0.25, fontSize: 18 }}>{value}</Typography>
      {helper && <Typography variant="caption2" sx={{ color }}>{helper}</Typography>}
    </Box>
  )
}

interface AdvancedPanelProps {
  title: string
  caption?: string
  actions?: ReactNode
  children: ReactNode
  fill?: boolean
  dense?: boolean
  bodySx?: SxProps<Theme>
}

export function AdvancedPanel({ title, caption, actions, children, fill = false, dense = false, bodySx }: AdvancedPanelProps) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: '5px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...(fill ? { flex: 1, minHeight: 0 } : { height: '100%' }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, px: dense ? 1.5 : 2, py: dense ? 1 : 1.25, borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
        <Box>
          <Typography variant="h4">{title}</Typography>
          {caption && <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{caption}</Typography>}
        </Box>
        {actions}
      </Box>
      <Box sx={{ p: dense ? 1.25 : 1.5, flex: fill ? 1 : undefined, minHeight: fill ? 0 : undefined, display: fill ? 'flex' : undefined, flexDirection: fill ? 'column' : undefined, ...bodySx }}>
        {children}
      </Box>
    </Box>
  )
}

export function StatusDot({ color = '#10b981' }: { color?: string }) {
  return <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
}

export function EmptyAdvanced({ title, text, action }: { title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: '5px', bgcolor: 'background.default' }}>
      <Typography variant="h4">{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: action ? 2 : 0 }}>{text}</Typography>
      {action && <Button variant="outlined" size="small" onClick={action.onClick}>{action.label}</Button>}
    </Box>
  )
}
