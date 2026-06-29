import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PlatformLogEntry } from '../../../api/types'
import {
  LOG_LEVEL_COLORS,
  LOG_LEVEL_LABELS,
  LOG_PAGE_SIZES,
  formatFriendlyTimestamp,
  getTableLogDisplay,
  groupLogsByTimeWindow,
  paginateItems,
  type LogViewDensity,
} from '../logUtils'

interface LogsTableProps {
  entries: PlatformLogEntry[]
  selectedId: string | null
  density: LogViewDensity
  onSelect: (entry: PlatformLogEntry) => void
}

const GRID_COLS = '72px 112px 128px minmax(0, 1fr)'

export default function LogsTable({ entries, selectedId, density, onSelect }: LogsTableProps) {
  const theme = useTheme()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [jumpPage, setJumpPage] = useState('')

  useEffect(() => {
    setPage(1)
  }, [entries.length, pageSize])

  const pagination = useMemo(() => paginateItems(entries, page, pageSize), [entries, page, pageSize])
  const groups = useMemo(() => groupLogsByTimeWindow(pagination.items, 5), [pagination.items])
  const rowPy = density === 'compact' ? 0.6 : 0.9

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleJump = () => {
    const target = Number(jumpPage)
    if (!Number.isFinite(target) || target < 1) return
    setPage(Math.min(Math.max(1, target), pagination.totalPages))
    setJumpPage('')
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          px: 1.5,
          py: 0.75,
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        {['Level', 'When', 'Service', 'Message'].map((label) => (
          <Typography key={label} variant="caption2" sx={{ color: 'text.disabled', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em' }}>
            {label.toUpperCase()}
          </Typography>
        ))}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, bgcolor: 'background.default' }}>
        {entries.length === 0 && (
          <Box sx={{ minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, px: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              No logs match your filters for this time range.
            </Typography>
            <Typography variant="caption2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
              Widen the time range, clear filters, or disable “Errors only”.
            </Typography>
          </Box>
        )}

        {groups.map((group) => (
          <Box key={group.key}>
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: alpha(theme.palette.background.paper, 0.95),
                borderBottom: 1,
                borderColor: 'divider',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <Typography variant="caption2" sx={{ color: 'primary.main', fontWeight: 700, fontSize: 11 }}>
                {group.label}
              </Typography>
              <Typography component="span" variant="caption2" sx={{ color: 'text.disabled', ml: 1, fontSize: 11 }}>
                · {group.entries.length} event{group.entries.length === 1 ? '' : 's'}
              </Typography>
            </Box>

            {group.entries.map((log) => {
              const selected = selectedId === log.id
              const display = getTableLogDisplay(log)
              const when = formatFriendlyTimestamp(log.timestamp)

              return (
                <Box
                  key={log.id}
                  onClick={() => onSelect(log)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(log)
                    }
                  }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: GRID_COLS,
                    alignItems: 'start',
                    gap: 0.75,
                    px: 1.5,
                    py: rowPy,
                    cursor: 'pointer',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: selected ? 'background.selected' : 'transparent',
                    borderLeft: selected ? `3px solid ${LOG_LEVEL_COLORS[log.level]}` : '3px solid transparent',
                    transition: 'background-color 0.15s ease',
                    '&:hover': { bgcolor: 'background.hover' },
                    ...(log.level === 'ERROR' && !selected
                      ? { bgcolor: alpha(LOG_LEVEL_COLORS.ERROR, 0.04) }
                      : {}),
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: LOG_LEVEL_COLORS[log.level],
                      border: `1px solid ${alpha(LOG_LEVEL_COLORS[log.level], 0.4)}`,
                      borderRadius: '4px',
                      px: 0.75,
                      py: 0.2,
                      lineHeight: 1.2,
                      width: 'fit-content',
                    }}
                  >
                    {LOG_LEVEL_LABELS[log.level]}
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: 'text.primary', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                      {when.relative}
                    </Typography>
                    <Typography sx={{ color: 'text.disabled', fontFamily: theme.typography.mono?.fontFamily, fontSize: 10, lineHeight: 1.3 }}>
                      {when.absolute}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      color: 'text.secondary',
                      fontSize: 11,
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                      fontFamily: theme.typography.mono?.fontFamily,
                    }}
                  >
                    {log.service}
                  </Typography>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: 'text.primary',
                        fontSize: density === 'compact' ? 12 : 13,
                        lineHeight: 1.4,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: density === 'compact' ? 1 : 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {display.headline}
                    </Typography>
                    {display.subtitle && (
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontSize: 11,
                          lineHeight: 1.35,
                          mt: 0.25,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {display.subtitle}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption2" sx={{ color: 'text.secondary', fontSize: 11 }}>
          Showing <strong>{pagination.start}–{pagination.end}</strong> of {pagination.total.toLocaleString()}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            sx={{ fontSize: 12, height: 30, minWidth: 96 }}
          >
            {LOG_PAGE_SIZES.map((size) => (
              <MenuItem key={size} value={size} sx={{ fontSize: 12 }}>
                {size} / page
              </MenuItem>
            ))}
          </Select>

          <IconButton size="small" disabled={pagination.page <= 1} onClick={() => setPage(1)}>
            <ChevronFirst size={16} />
          </IconButton>
          <IconButton size="small" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={16} />
          </IconButton>

          <Typography variant="caption2" sx={{ color: 'text.secondary', minWidth: 80, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>
            {pagination.page} / {pagination.totalPages}
          </Typography>

          <IconButton size="small" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight size={16} />
          </IconButton>
          <IconButton size="small" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)}>
            <ChevronLast size={16} />
          </IconButton>

          <TextField
            size="small"
            placeholder="Go to"
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            sx={{ width: 68, '& .MuiOutlinedInput-root': { height: 30, fontSize: 12 } }}
          />
        </Box>
      </Box>
    </Box>
  )
}
