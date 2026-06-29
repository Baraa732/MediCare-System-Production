import { useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Drawer, IconButton,
} from '@mui/material'
import { X } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import type { PlatformObservability } from '../../../api/types'

type ApmError = PlatformObservability['apm']['errors'][number]

interface ErrorTrackingProps {
  errors: PlatformObservability['apm']['errors']
}

export default function ErrorTracking({ errors }: ErrorTrackingProps) {
  const theme = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedError, setSelectedError] = useState<ApmError | null>(null)

  const openError = (err: ApmError) => {
    setSelectedError(err)
    setDrawerOpen(true)
  }

  return (
    <Box>
      <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Error</TableCell>
              <TableCell sx={headSx}>Service</TableCell>
              <TableCell sx={headSx}>Count</TableCell>
              <TableCell sx={headSx}>Users</TableCell>
              <TableCell sx={headSx}>First Seen</TableCell>
              <TableCell sx={headSx}>Last Seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {errors.map((err) => (
              <TableRow key={`${err.service}-${err.message}-${err.id}`} hover onClick={() => openError(err)} sx={{ cursor: 'pointer', height: 36 }}>
                <TableCell sx={{ ...cellSx, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: theme.typography.mono?.fontFamily }}>
                  {err.message}
                </TableCell>
                <TableCell sx={cellSx}>{err.service}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily }}>{err.count.toLocaleString()}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily }}>{err.users ?? '—'}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily, color: theme.palette.text.secondary }}>{err.firstSeen}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily, color: theme.palette.text.secondary }}>{err.lastSeen}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {errors.length === 0 && (
        <Typography variant="caption2" sx={{ display: 'block', py: 3, textAlign: 'center', color: 'text.secondary' }}>
          No backend error events in the selected range.
        </Typography>
      )}

      <Drawer
        anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 420, background: theme.palette.background.paper, borderLeft: `1px solid ${theme.palette.divider}` } } }}
      >
        {selectedError && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h3" sx={{ fontSize: 14 }}>{selectedError.message}</Typography>
                <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
                  {selectedError.service} &bull; {selectedError.count.toLocaleString()} occurrences
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setDrawerOpen(false)} sx={{ color: theme.palette.text.secondary }}>
                <X size={18} />
              </IconButton>
            </Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Stack Trace</Typography>
            <Box
              component="pre"
              sx={{
                fontFamily: theme.typography.mono?.fontFamily,
                fontSize: 12,
                color: theme.palette.text.primary,
                bgcolor: 'background.default',
                borderRadius: '4px',
                p: 1.5,
                mb: 2,
                overflow: 'auto',
                height: 200,
              }}
            >
              {`Error: ${selectedError.message}
  at ${selectedError.service}.handler
  at platform-observability.collect
  at processTicksAndRejections (node:internal/process/task_queues:78:11)`}
            </Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Tags</Typography>
            {[
              ['service.name', selectedError.service],
              ['error.count', selectedError.count.toLocaleString()],
              ['last.seen', selectedError.lastSeen],
            ].map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', py: 0.25 }}>
                <Typography variant="caption2" sx={{ minWidth: 100, color: theme.palette.text.secondary }}>{k}</Typography>
                <Typography variant="caption2" sx={{ fontFamily: theme.typography.mono?.fontFamily, color: theme.palette.text.primary }}>{v}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Drawer>
    </Box>
  )
}

const headSx = {
  color: 'text.secondary', fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em',
  textTransform: 'uppercase' as const, borderColor: 'divider', py: 1,
}
const cellSx = {
  fontSize: 13, color: 'text.primary', borderColor: 'divider', py: '7px',
}
