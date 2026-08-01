import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PlatformLogEntry } from '../../../api/types'
import {
  LOG_LEVEL_COLORS,
  LOG_LEVEL_LABELS,
  LOG_PAGE_SIZES,
  formatLogTime,
  getTableLogDisplay,
  paginateItems,
  type LogViewDensity,
} from '../logUtils'

interface LogsTableProps {
  entries: PlatformLogEntry[]
  selectedId: string | null
  density: LogViewDensity
  onSelect: (entry: PlatformLogEntry) => void
}

export default function LogsTable({ entries, selectedId, density, onSelect }: LogsTableProps) {
  const theme = useTheme()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [jumpPage, setJumpPage] = useState('')

  useEffect(() => {
    setPage(1)
  }, [entries.length, pageSize])

  const pagination = useMemo(() => paginateItems(entries, page, pageSize), [entries, page, pageSize])
  const compact = density === 'compact'

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
      <div className="logs-table-head">
        <span>Level</span>
        <span>Time</span>
        <span>Service</span>
        <span>Message</span>
        <span>Ctx</span>
      </div>

      <div className="logs-table-wrap">
        {entries.length === 0 && (
          <Box sx={{ minHeight: 180, display: 'grid', placeItems: 'center', px: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
              No logs match filters for this window.
            </Typography>
          </Box>
        )}

        {pagination.items.map((log) => {
          const selected = selectedId === log.id
          const display = getTableLogDisplay(log)
          const rowClass = [
            'logs-table-row',
            compact ? 'logs-table-row--compact' : '',
            selected ? 'is-selected' : '',
            log.level === 'ERROR' && !selected ? 'is-error' : '',
          ].filter(Boolean).join(' ')

          return (
            <div
              key={log.id}
              className={rowClass}
              onClick={() => onSelect(log)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(log)
                }
              }}
              style={{
                borderLeft: selected ? `3px solid ${LOG_LEVEL_COLORS[log.level]}` : '3px solid transparent',
                ['--logs-border' as string]: theme.palette.divider,
                ['--logs-row-hover' as string]: theme.palette.action.hover,
                ['--logs-row-selected' as string]: theme.palette.action.selected,
              }}
            >
              <span
                className="logs-level"
                style={{ color: LOG_LEVEL_COLORS[log.level], borderColor: `${LOG_LEVEL_COLORS[log.level]}66` }}
              >
                {LOG_LEVEL_LABELS[log.level]}
              </span>

              <span className="logs-time">{formatLogTime(log.timestamp)}</span>

              <span className="logs-service" title={log.service}>
                {log.service.replace(/-service$/, '')}
              </span>

              <div className="logs-message">
                <div className="logs-message__title" title={display.headline}>
                  {display.headline}
                </div>
                {!compact && display.subtitle && (
                  <div className="logs-message__detail" title={display.subtitle}>
                    {display.subtitle}
                  </div>
                )}
              </div>

              <span className="logs-context" title={display.context ?? ''}>
                {display.context ?? '—'}
              </span>
            </div>
          )
        })}
      </div>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.6,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption2" sx={{ color: 'text.secondary', fontSize: 11 }}>
          {pagination.start}–{pagination.end} of {pagination.total.toLocaleString()}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            sx={{ fontSize: 11, height: 28, minWidth: 88 }}
          >
            {LOG_PAGE_SIZES.map((size) => (
              <MenuItem key={size} value={size} sx={{ fontSize: 11 }}>
                {size}
              </MenuItem>
            ))}
          </Select>

          <IconButton size="small" disabled={pagination.page <= 1} onClick={() => setPage(1)}>
            <ChevronFirst size={15} />
          </IconButton>
          <IconButton size="small" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={15} />
          </IconButton>

          <Typography variant="caption2" sx={{ color: 'text.secondary', minWidth: 56, textAlign: 'center', fontSize: 11 }}>
            {pagination.page}/{pagination.totalPages}
          </Typography>

          <IconButton size="small" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight size={15} />
          </IconButton>
          <IconButton size="small" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)}>
            <ChevronLast size={15} />
          </IconButton>

          <TextField
            size="small"
            placeholder="#"
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            sx={{ width: 44, '& .MuiOutlinedInput-root': { height: 28, fontSize: 11 } }}
          />
        </Box>
      </Box>
    </Box>
  )
}
