import { Box, Typography, Grid, Button, Skeleton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { ApmService } from '../../../api/types'
import MetricChart from './MetricChart'

interface ServiceOverviewCardsProps {
  services: ApmService[]
  loading?: boolean
  onSelectService: (svc: ApmService) => void
}

const statusColor: Record<string, string> = { healthy: '#10b981', degraded: '#f59e0b', down: '#ef4444' }

export default function ServiceOverviewCards({ services, loading, onSelectService }: ServiceOverviewCardsProps) {
  const theme = useTheme()

  if (loading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton variant="rounded" height={152} />
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Grid container spacing={2}>
      {services.map((svc) => (
        <Grid key={svc.name} size={{ xs: 12, sm: 6, md: 4 }}>
          <Box
            sx={{
              p: 2,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '4px',
              borderLeft: `3px solid ${statusColor[svc.status]}`,
              cursor: 'pointer',
            }}
            onClick={() => onSelectService(svc)}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[svc.status] }} />
                <Typography variant="h4">{svc.name}</Typography>
              </Box>
              <Typography variant="caption2" sx={{ color: statusColor[svc.status], textTransform: 'uppercase' }}>
                {svc.status}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
              <Box>
                <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>Req/s</Typography>
                <Typography variant="body2" sx={{ fontFamily: theme.typography.mono?.fontFamily }}>{svc.reqRate.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>Errors</Typography>
                <Typography variant="body2" sx={{
                  fontFamily: theme.typography.mono?.fontFamily,
                  color: svc.errorRate > 5 ? '#ef4444' : svc.errorRate > 1 ? '#f59e0b' : theme.palette.text.primary,
                }}>
                  {svc.errorRate}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>P50/P95</Typography>
                <Typography variant="body2" sx={{ fontFamily: theme.typography.mono?.fontFamily }}>
                  {svc.p50}ms / {svc.p95 !== null ? `${svc.p95}ms` : '—'}
                </Typography>
              </Box>
            </Box>

            <MetricChart data={svc.series} color={statusColor[svc.status]} height={40} showArea={false} />

            <Button size="small" sx={{ fontSize: 12, mt: 1 }} onClick={(e) => { e.stopPropagation(); onSelectService(svc) }}>
              View Service →
            </Button>
          </Box>
        </Grid>
      ))}
    </Grid>
  )
}
