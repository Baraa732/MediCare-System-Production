import { Box, Drawer, IconButton, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { X } from 'lucide-react'
import type { PlatformLogEntry } from '../../../api/types'
import { LOG_LEVEL_COLORS, LOG_LEVEL_LABELS, formatFriendlyTimestamp, displayLogMessage } from '../logUtils'

interface LogDetailDrawerProps {
  entry: PlatformLogEntry | null
  open: boolean
  onClose: () => void
}

export default function LogDetailDrawer({ entry, open, onClose }: LogDetailDrawerProps) {
  const theme = useTheme()

  const display = entry ? displayLogMessage(entry) : null
  const when = entry ? formatFriendlyTimestamp(entry.timestamp) : null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 440, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h3" sx={{ fontSize: 16 }}>
          Log Detail
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </Box>

      {entry && display && when && (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: '4px', borderLeft: `3px solid ${LOG_LEVEL_COLORS[entry.level]}` }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{display.title}</Typography>
            {display.hint && (
              <Typography variant="caption2" sx={{ color: LOG_LEVEL_COLORS[entry.level] }}>{display.hint}</Typography>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography variant="caption2" sx={{ color: 'text.disabled' }}>Level</Typography>
              <Typography variant="body2" sx={{ color: LOG_LEVEL_COLORS[entry.level], fontWeight: 600 }}>
                {LOG_LEVEL_LABELS[entry.level]}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption2" sx={{ color: 'text.disabled' }}>Service</Typography>
              <Typography variant="body2">{entry.service}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption2" sx={{ color: 'text.disabled' }}>When</Typography>
              <Typography variant="body2">{when.relative} · {when.absolute}</Typography>
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{when.dayLabel} · {entry.timestamp}</Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="caption2" sx={{ color: 'text.disabled', mb: 0.5, display: 'block' }}>
              Raw payload
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.25,
                borderRadius: '4px',
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
                fontFamily: theme.typography.mono?.fontFamily,
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 360,
                overflow: 'auto',
              }}
            >
              {entry.raw}
            </Box>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
