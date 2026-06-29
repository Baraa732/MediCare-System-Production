import { Box, Typography } from '@mui/material'

const colors: Record<string, string> = {
  healthy: '#10b981',
  up: '#10b981',
  ok: '#10b981',
  operational: '#10b981',
  degraded: '#f59e0b',
  slow: '#f59e0b',
  down: '#ef4444',
  error: '#ef4444',
  outage: '#ef4444',
}

export function statusColor(status: string) {
  return colors[status] ?? '#8b93a8'
}

export default function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status)

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption2" sx={{ color, textTransform: 'uppercase', fontWeight: 600 }}>
        {status}
      </Typography>
    </Box>
  )
}
