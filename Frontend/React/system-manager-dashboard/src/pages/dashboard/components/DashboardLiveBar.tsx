import { memo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import { Box, Button, Chip, Switch, Typography } from '@mui/material'
import { RefreshCw } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { DashboardTimeRange } from '../../../store/dashboardStore'

dayjs.extend(relativeTime)

interface DashboardLiveBarProps {
  live: boolean
  onLiveChange: (live: boolean) => void
  mode: 'sse' | 'poll' | 'off'
  lastSyncAt: number | null
  timeRange: DashboardTimeRange
  onRefresh: () => void
  fetching?: boolean
}

function DashboardLiveBar({
  live,
  onLiveChange,
  mode,
  lastSyncAt,
  timeRange,
  onRefresh,
  fetching,
}: DashboardLiveBarProps) {
  const theme = useTheme()
  const syncLabel = lastSyncAt
    ? `Last update ${dayjs(lastSyncAt).fromNow()}`
    : live
      ? 'Waiting for first update'
      : 'Manual refresh only'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: '4px',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.6),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
          {timeRange} window · {syncLabel}
        </Typography>
        {live && mode !== 'off' && (
          <Chip
            size="small"
            label={mode === 'sse' ? 'SSE live' : 'Polling live'}
            color={mode === 'sse' ? 'success' : 'default'}
            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
          />
        )}
        {fetching && (
          <Chip size="small" label="Updating…" color="default" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption2" sx={{ color: 'text.secondary' }}>Auto-refresh</Typography>
        <Switch size="small" checked={live} onChange={(_, checked) => onLiveChange(checked)} />
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshCw size={14} />}
          onClick={onRefresh}
          disabled={fetching}
          sx={{ textTransform: 'none', minWidth: 88 }}
        >
          Refresh
        </Button>
      </Box>
    </Box>
  )
}

export default memo(DashboardLiveBar)
