import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Chip, IconButton, Tab, Tabs, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Braces, Fingerprint, GripVertical, Hash, Layers, Server, X } from 'lucide-react'
import type { PlatformLogEntry } from '../../../api/types'
import {
  LOG_LEVEL_COLORS,
  LOG_LEVEL_LABELS,
  buildLogJsonDocument,
  formatFriendlyTimestamp,
  getTableLogDisplay,
  humanizeLogMessage,
  isJsonLike,
} from '../logUtils'
import JsonLogViewer from './JsonLogViewer'

const PANEL_WIDTH_KEY = 'medicare-logs-json-panel-width'
const DEFAULT_PANEL_WIDTH = 420
const MIN_PANEL_WIDTH = 300
const MAX_PANEL_WIDTH = 900

interface LogDetailPanelProps {
  entry: PlatformLogEntry | null
  onClose: () => void
}

type DetailTab = 'message' | 'raw' | 'full'

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH
  const stored = Number(window.localStorage.getItem(PANEL_WIDTH_KEY))
  if (!Number.isFinite(stored)) return DEFAULT_PANEL_WIDTH
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, stored))
}

export default function LogDetailPanel({ entry, onClose }: LogDetailPanelProps) {
  const theme = useTheme()
  const [tab, setTab] = useState<DetailTab>('message')
  const [panelWidth, setPanelWidth] = useState(readStoredWidth)
  const resizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(DEFAULT_PANEL_WIDTH)

  const when = entry ? formatFriendlyTimestamp(entry.timestamp) : null
  const tableDisplay = entry ? getTableLogDisplay(entry) : null
  const humanized = entry ? humanizeLogMessage(entry) : null
  const fullDoc = useMemo(() => (entry ? buildLogJsonDocument(entry) : null), [entry])

  const tabContent = useMemo(() => {
    if (!entry || !fullDoc) return { value: '', isNativeJson: false, title: 'JSON' }

    if (tab === 'raw') {
      const rawParsed = entry.raw?.trim()
      if (rawParsed && isJsonLike(rawParsed)) {
        try {
          return {
            value: JSON.stringify(JSON.parse(rawParsed), null, 2),
            isNativeJson: true,
            title: 'Raw Payload',
          }
        } catch {
          // fall through
        }
      }
      return {
        value: JSON.stringify({ raw: entry.raw || '' }, null, 2),
        isNativeJson: false,
        title: 'Raw Payload',
      }
    }

    if (tab === 'full') {
      const full = {
        id: entry.id,
        timestamp: entry.timestamp,
        level: entry.level,
        service: entry.service,
        message: entry.message,
        raw: entry.raw,
        traceId: entry.traceId ?? null,
        spanId: entry.spanId ?? null,
        requestId: entry.requestId ?? null,
      }
      return {
        value: JSON.stringify(full, null, 2),
        isNativeJson: false,
        title: 'Full Entry',
      }
    }

    const messageParsed = entry.message?.trim()
    if (messageParsed && isJsonLike(messageParsed)) {
      try {
        return {
          value: JSON.stringify(JSON.parse(messageParsed), null, 2),
          isNativeJson: true,
          title: 'Message JSON',
        }
      } catch {
        // fall through
      }
    }

    return {
      value: fullDoc.formatted,
      isNativeJson: fullDoc.isNativeJson,
      title: 'Message JSON',
    }
  }, [entry, fullDoc, tab])

  const handleResizeStart = useCallback((clientX: number) => {
    resizingRef.current = true
    startXRef.current = clientX
    startWidthRef.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizingRef.current) return
      const delta = startXRef.current - event.clientX
      const next = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidthRef.current + delta))
      setPanelWidth(next)
    }

    const handleUp = () => {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setPanelWidth((current) => {
        window.localStorage.setItem(PANEL_WIDTH_KEY, String(current))
        return current
      })
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  const panelShellSx = {
    width: { xs: '100%', lg: panelWidth },
    flexShrink: 0,
    borderLeft: { lg: 1 },
    borderColor: 'divider',
    bgcolor: 'background.paper',
    position: 'relative' as const,
    minHeight: 0,
  }

  if (!entry) {
    return (
      <Box
        sx={{
          ...panelShellSx,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.25,
          p: 2.5,
          minHeight: 280,
        }}
      >
        <ResizeHandle onResizeStart={handleResizeStart} />
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.25),
            color: 'primary.main',
          }}
        >
          <Braces size={22} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'text.primary' }}>JSON Inspector</Typography>
        <Typography variant="caption2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 240 }}>
          Select a log row to view the formatted JSON payload. Select text to copy.
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        ...panelShellSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        alignSelf: { lg: 'stretch' },
      }}
    >
      <ResizeHandle onResizeStart={handleResizeStart} />

      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          bgcolor: 'background.elevated',
          flexShrink: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Chip
              label={LOG_LEVEL_LABELS[entry.level]}
              size="small"
              sx={{
                height: 22,
                fontSize: 10,
                fontWeight: 800,
                bgcolor: alpha(LOG_LEVEL_COLORS[entry.level], 0.12),
                color: LOG_LEVEL_COLORS[entry.level],
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: 'text.primary' }}>
            {tableDisplay?.headline ?? humanized?.title}
          </Typography>
          {tableDisplay?.subtitle && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.35 }}>
              {tableDisplay.subtitle}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </Box>

      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Chip icon={<Server size={12} />} label={entry.service} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />
        {when && <Chip label={`${when.relative}`} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />}
        {entry.traceId && <Chip icon={<Fingerprint size={12} />} label="trace" size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />}
        {entry.requestId && <Chip icon={<Hash size={12} />} label="request" size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />}
        {entry.spanId && <Chip icon={<Layers size={12} />} label="span" size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />}
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value: DetailTab) => setTab(value)}
        variant="fullWidth"
        sx={{
          minHeight: 34,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 34, fontSize: 11, fontWeight: 600, py: 0 },
        }}
      >
        <Tab value="message" label="Message" />
        <Tab value="raw" label="Raw" />
        <Tab value="full" label="Full" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'visible', p: 1.25, minHeight: 0 }}>
        <JsonLogViewer
          key={`${entry.id}-${tab}`}
          value={tabContent.value}
          title={tabContent.title}
          isNativeJson={tabContent.isNativeJson}
        />
        <Typography variant="caption2" sx={{ color: 'text.disabled', display: 'block', mt: 0.75 }}>
          {when?.dayLabel} · {entry.timestamp}
        </Typography>
      </Box>
    </Box>
  )
}

function ResizeHandle({ onResizeStart }: { onResizeStart: (clientX: number) => void }) {
  const theme = useTheme()

  return (
    <Box
      onMouseDown={(event) => {
        event.preventDefault()
        onResizeStart(event.clientX)
      }}
      sx={{
        display: { xs: 'none', lg: 'flex' },
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 8,
        transform: 'translateX(-50%)',
        cursor: 'col-resize',
        zIndex: 3,
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.disabled',
        '&:hover, &:active': {
          color: 'primary.main',
          '& .resize-rail': {
            bgcolor: alpha(theme.palette.primary.main, 0.35),
            width: 3,
          },
        },
      }}
    >
      <Box
        className="resize-rail"
        sx={{
          width: 2,
          height: 48,
          borderRadius: 2,
          bgcolor: 'divider',
          transition: 'background-color 0.15s ease, width 0.15s ease',
        }}
      />
      <GripVertical size={12} style={{ position: 'absolute', opacity: 0.5 }} />
    </Box>
  )
}
