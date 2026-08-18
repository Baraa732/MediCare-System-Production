import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Search, X } from 'lucide-react'
import type { OperationalTrace } from '../../api/types'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage, PbiGrid } from '../../components/advanced/AdvancedPage'
import LinePanel from '../observability/LinePanel'
import StatusBadge, { statusColor } from '../observability/StatusBadge'

export default function Traces() {
  const [range, setRange] = useState('1h')
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedTrace, setSelectedTrace] = useState<OperationalTrace | null>(null)
  const { data, loading, error } = useObservabilityData(range, true)

  const traces = data?.traces.items ?? []
  const services = useMemo(() => ['All', ...Array.from(new Set(traces.map((trace) => trace.rootService)))], [traces])
  const filteredTraces = useMemo(() => traces.filter((trace) => {
    const matchesSearch = !search || trace.rootOp.toLowerCase().includes(search.toLowerCase()) || trace.rootService.toLowerCase().includes(search.toLowerCase())
    const matchesService = serviceFilter === 'All' || trace.rootService === serviceFilter
    const matchesStatus = statusFilter === 'All' || trace.status === statusFilter
    return matchesSearch && matchesService && matchesStatus
  }), [search, serviceFilter, statusFilter, traces])

  const latencySeries = useMemo(() => {
    const buckets = Array.from({ length: 40 }, (_, index) => filteredTraces[index % Math.max(1, filteredTraces.length)]?.duration ?? 0)
    return [{ name: 'Trace Duration', data: buckets, color: '#06b6d4' }]
  }, [filteredTraces])

  return (
    <ObservabilityPage fill>
      <AdvancedPageHeader
        title="Traces"
        eyebrow="Observability / Traces"
        description="Operational traces from live service events and correlated logs."
        color="#06b6d4"
        status="Live"
        compact
        actions={
          <Select value={range} onChange={(e) => setRange(e.target.value)} size="small" sx={{ fontSize: 13, height: 28 }}>
            <MenuItem value="15m">Last 15m</MenuItem>
            <MenuItem value="1h">Last 1h</MenuItem>
            <MenuItem value="6h">Last 6h</MenuItem>
            <MenuItem value="24h">Last 24h</MenuItem>
          </Select>
        }
      />

      {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ flexShrink: 0, minHeight: 36 }}>
        <Tab label="Overview" />
        <Tab label="Traces" />
        <Tab label="Service Map" />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {tab === 0 && (
        <Box>
          <PbiGrid spacing={1.5}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Grid key={i} size={{ xs: 6, md: 3 }}>
                    <Skeleton variant="rounded" height={72} />
                  </Grid>
                ))
              : [
                  { label: 'Total Traces', value: data?.traces.summary.total ?? 0, color: '#06b6d4' },
                  { label: 'Error Traces', value: data?.traces.summary.errors ?? 0, color: '#ef4444' },
                  { label: 'Avg Duration', value: `${data?.traces.summary.avgDuration ?? 0}ms`, color: '#8b5cf6' },
                  { label: 'Events', value: data?.traces.summary.throughput ?? 0, color: '#10b981' },
                ].map((card) => (
                  <Grid key={card.label} size={{ xs: 6, md: 3 }}>
                    <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: '4px', borderLeft: `3px solid ${card.color}`, height: '100%' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{card.label}</Typography>
                      <Typography variant="metricSm">{card.value}</Typography>
                    </Box>
                  </Grid>
                ))}
          </PbiGrid>

          <Box sx={{ mt: 1.5 }}>
            <AdvancedPanel title="Trace Duration" caption="P50 trend from filtered traces" dense bodySx={{ p: 0 }}>
              <LinePanel title="" series={latencySeries} height={240} bare />
            </AdvancedPanel>
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <AdvancedPanel title="Trace Explorer" caption={`${filteredTraces.length} traces`} dense fill bodySx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <TextField
              size="small"
              placeholder="Search traces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <Search size={14} color="var(--cc-muted)" style={{ marginRight: 6 }} /> } }}
              sx={{ width: 300 }}
            />
            <Select size="small" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} sx={{ fontSize: 13, minWidth: 170 }}>
              {services.map((service) => <MenuItem key={service} value={service}>{service}</MenuItem>)}
            </Select>
            <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ fontSize: 13, minWidth: 130 }}>
              {['All', 'ok', 'slow', 'error'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </Select>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <TraceTable traces={filteredTraces} onSelectTrace={setSelectedTrace} />
            {!loading && filteredTraces.length === 0 && (
              <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', py: 3, textAlign: 'center' }}>
                No traces found for the selected filters.
              </Typography>
            )}
          </Box>
        </AdvancedPanel>
      )}

      {tab === 2 && (
        <AdvancedPanel title="Service Map" caption="Node health overview" dense>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(data?.apm.serviceMap.nodes ?? []).map((node) => (
              <Box key={node.id} sx={{ p: 1.25, minWidth: 180, flex: '1 1 180px', border: 1, borderColor: 'divider', borderRadius: '4px', borderLeft: `3px solid ${statusColor(node.status)}` }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{node.name}</Typography>
                <StatusBadge status={node.status} />
              </Box>
            ))}
          </Box>
        </AdvancedPanel>
      )}
      </Box>

      <TraceDetailDrawer trace={selectedTrace} open={Boolean(selectedTrace)} onClose={() => setSelectedTrace(null)} />
    </ObservabilityPage>
  )
}

function TraceTable({ traces, onSelectTrace }: { traces: OperationalTrace[]; onSelectTrace: (trace: OperationalTrace) => void }) {
  const theme = useTheme()
  return (
    <TableContainer sx={{ background: 'transparent', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={32} sx={headSx} />
            <TableCell width={100} sx={headSx}>Trace ID</TableCell>
            <TableCell width={160} sx={headSx}>Root Service</TableCell>
            <TableCell sx={headSx}>Root Operation</TableCell>
            <TableCell width={110} sx={headSx}>Duration</TableCell>
            <TableCell width={72} sx={headSx}>Spans</TableCell>
            <TableCell width={72} sx={headSx}>Errors</TableCell>
            <TableCell width={120} sx={headSx}>Start Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {traces.map((trace) => (
            <TableRow key={trace.id} hover onClick={() => onSelectTrace(trace)} sx={{ cursor: 'pointer', height: 36 }}>
              <TableCell sx={cellSx}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusColor(trace.status) }} /></TableCell>
              <TableCell sx={{ ...cellSx, color: '#06b6d4', fontFamily: theme.typography.mono?.fontFamily }}>{trace.id.substring(0, 8)}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily }}>{trace.rootService}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily }}>{trace.rootOp}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily, color: trace.duration > 1000 ? '#ef4444' : 'text.primary' }}>{trace.duration}ms</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily }}>{trace.spans}</TableCell>
              <TableCell sx={{ ...cellSx, color: trace.errors > 0 ? '#ef4444' : 'text.disabled' }}>{trace.errors || '—'}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily, color: 'text.secondary' }}>{trace.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function TraceDetailDrawer({ trace, open, onClose }: { trace: OperationalTrace | null; open: boolean; onClose: () => void }) {
  const theme = useTheme()
  if (!trace) return null

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 640, bgcolor: 'background.paper', borderLeft: 1, borderColor: 'divider' } } }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h3">Trace: {trace.id.substring(0, 8)}</Typography>
          <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{trace.rootOp} · {trace.duration}ms · {trace.spans} spans</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Correlated Logs</Typography>
        {trace.logs.map((log) => (
          <Box key={log.id} sx={{ p: 1.5, mb: 1, border: 1, borderColor: 'divider', borderRadius: '4px' }}>
            <StatusBadge status={log.level.toLowerCase()} />
            <Typography variant="body2" sx={{ mt: 1, fontFamily: theme.typography.mono?.fontFamily, wordBreak: 'break-word' }}>{log.message}</Typography>
            <Typography variant="caption2" sx={{ color: 'text.disabled' }}>{log.timestamp}</Typography>
          </Box>
        ))}
      </Box>
    </Drawer>
  )
}

const headSx = { color: 'text.secondary', fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderColor: 'divider', py: 1 }
const cellSx = { fontSize: 13, color: 'text.primary', borderColor: 'divider', py: '7px' }
