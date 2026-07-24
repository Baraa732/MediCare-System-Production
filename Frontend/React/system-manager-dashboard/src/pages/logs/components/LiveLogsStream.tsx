import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Pause, Play } from 'lucide-react'
import type { PlatformLogEntry } from '../../../api/types'
import { useObservabilityStore } from '../../../store/observabilityStore'
import { LOG_LEVEL_COLORS, formatFriendlyTimestamp, getTableLogDisplay } from '../logUtils'

function extractTraceId(log: PlatformLogEntry): string | null {
  if (log.traceId) return log.traceId
  const haystack = `${log.raw ?? ''} ${log.message}`
  const match = haystack.match(/trace[_-]?id[=:\s"']+([a-f0-9-]{8,36})/i)
    ?? haystack.match(/\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i)
    ?? haystack.match(/\btrace:([a-f0-9]{8,16})\b/i)
  return match?.[1] ?? null
}

interface LiveLogsStreamProps {
  entries: PlatformLogEntry[]
  live: boolean
  onSelect: (entry: PlatformLogEntry) => void
  selectedId: string | null
}

function LiveLogsStream({ entries, live, onSelect, selectedId }: LiveLogsStreamProps) {
  const theme = useTheme()
  const scrollRef = useRef<HTMLDivElement>(null)
  const paused = useObservabilityStore((s) => s.logsStreamPaused)
  const setPaused = useObservabilityStore((s) => s.setLogsStreamPaused)
  const autoScroll = useObservabilityStore((s) => s.logsAutoScroll)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const streamEntries = useMemo(() => entries.slice(0, 120), [entries])

  useEffect(() => {
    if (!live) return
    const incoming = streamEntries.filter((e) => !seenIds.has(e.id))
    if (!incoming.length) return
    setSeenIds((prev) => {
      const next = new Set(prev)
      for (const e of incoming) next.add(e.id)
      return next
    })
    setNewIds((prev) => {
      const next = new Set(prev)
      for (const e of incoming) next.add(e.id)
      return next
    })
    const timer = setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev)
        for (const e of incoming) next.delete(e.id)
        return next
      })
    }, 1_200)
    return () => clearTimeout(timer)
  }, [live, seenIds, streamEntries])

  useEffect(() => {
    if (!live || paused || !autoScroll || !scrollRef.current) return
    scrollRef.current.scrollTop = 0
  }, [autoScroll, live, paused, streamEntries.length])

  if (!live) return null

  if (!streamEntries.length) {
    return (
      <Box sx={{ px: 1.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
          No live events in the current filter window.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption2" sx={{ color: 'primary.main', fontWeight: 700 }}>LIVE STREAM · {streamEntries.length} events</Typography>
        <Button size="small" variant="outlined" startIcon={paused ? <Play size={12} /> : <Pause size={12} />} onClick={() => setPaused(!paused)} sx={{ height: 26, fontSize: 11 }}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </Box>

      <Box ref={scrollRef} sx={{ maxHeight: 280, overflow: 'auto' }}>
        {streamEntries.map((log) => {
          const traceId = extractTraceId(log)
          const isNew = newIds.has(log.id)
          const isCritical = log.level === 'ERROR'
          const display = getTableLogDisplay(log)
          const when = formatFriendlyTimestamp(log.timestamp)

          return (
            <Box
              key={log.id}
              onClick={() => onSelect(log)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '72px 110px 100px minmax(0, 1fr) 90px',
                gap: 0.5,
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: selectedId === log.id ? 'background.hover' : isNew ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                animation: isNew ? 'logSlideIn 0.35s ease-out' : undefined,
                '@keyframes logSlideIn': { from: { opacity: 0, transform: 'translateY(-6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                ...(isCritical ? {
                  '@keyframes criticalPulse': { '0%, 100%': { boxShadow: 'inset 0 0 0 0 transparent' }, '50%': { boxShadow: `inset 3px 0 0 ${LOG_LEVEL_COLORS.ERROR}` } },
                  animation: `${isNew ? 'logSlideIn 0.35s ease-out, ' : ''}criticalPulse 2.5s ease-in-out infinite`,
                } : {}),
              }}
            >
              <Typography variant="caption2" sx={{ color: LOG_LEVEL_COLORS[log.level], fontWeight: 700 }}>{log.level}</Typography>
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{when.relative}</Typography>
              <Typography variant="caption2" sx={{ color: 'text.secondary', fontFamily: theme.typography.mono?.fontFamily, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.service}</Typography>
              <Typography
                variant="caption2"
                sx={{
                  color: 'text.primary',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.4,
                }}
                title={display.headline}
              >
                {display.headline}
              </Typography>
              <Typography variant="caption2" sx={{ color: traceId ? 'primary.main' : 'text.disabled', fontFamily: theme.typography.mono?.fontFamily, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {traceId ? traceId.slice(0, 8) : '—'}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default memo(LiveLogsStream)
