import { Card, CardContent, Box, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  color?: string
  hint?: string
}

export default function StatCard({ label, value, icon: Icon, color, hint }: StatCardProps) {
  const theme = useTheme()
  const accent = color ?? theme.palette.primary.main

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '8px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            bgcolor: alpha(accent, 0.12),
          }}
        >
          <Icon size={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="metricSm" sx={{ display: 'block', color: 'text.primary' }}>
            {value}
          </Typography>
          <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
          {hint && (
            <Typography variant="caption2" sx={{ color: 'text.disabled', display: 'block' }}>
              {hint}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
