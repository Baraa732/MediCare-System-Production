import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { AlertTriangle, FileText, ScrollText, Siren, Zap } from 'lucide-react'
import { AdvancedPageHeader, AdvancedPanel, CommandMetric, ObservabilityPage, PbiGrid, StatusDot } from '../../components/advanced/AdvancedPage'
import { MotionHeader, MotionMetricGridItem, MotionPanel, MotionToolbar } from '../../components/motion/AnimatedSections'
import { PageMotion } from '../../components/motion/PageMotion'
import { usePlatformLogs } from '../../hooks/usePlatformLogs'
import { notify } from '../../lib/toast'
import { parseLogsSearchParams, useLogsFilterStore } from '../../store/logsFilterStore'
import type { PlatformLogEntry, PlatformLogLevel } from '../../api/types'
import LiveLogsStream from './components/LiveLogsStream'
import LogDetailPanel from './components/LogDetailPanel'
import LogsChartsRow from './components/LogsChartsRow'
import LogsFilterBar from './components/LogsFilterBar'
import LogsFilterHeader from './components/LogsFilterHeader'
import LogsTable from './components/LogsTable'
import LogsToolbar from './components/LogsToolbar'
import {
  LOG_LEVEL_COLORS,
  applyLogFilters,
  buildHistogramFromEntries,
  countLevelsFromEntries,
  countServicesFromEntries,
  sortLogEntries,
  type LogSortOrder,
  type LogViewDensity,
} from './logUtils'

export default function LogsPage() {
  const [searchParams] = useSearchParams()
  const consumePendingFilters = useLogsFilterStore((s) => s.consumePendingFilters)

  const [search, setSearch] = useState('')
  const [range, setRange] = useState('1h')
  const [live, setLive] = useState(true)
  const [showLiveStream, setShowLiveStream] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<PlatformLogLevel[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [pinnedEntry, setPinnedEntry] = useState<PlatformLogEntry | null>(null)
  const [filtersBootstrapped, setFiltersBootstrapped] = useState(false)
  const [sortOrder, setSortOrder] = useState<LogSortOrder>('newest')
  const [density, setDensity] = useState<LogViewDensity>('comfortable')

  const errorsOnly = selectedLevels.length === 1 && selectedLevels[0] === 'ERROR'

  useEffect(() => {
    if (filtersBootstrapped) return
    const pending = consumePendingFilters()
    const urlFilters = parseLogsSearchParams(searchParams)
    const merged = {
      services: pending?.services ?? urlFilters.services,
      levels: pending?.levels ?? urlFilters.levels,
      search: pending?.search ?? urlFilters.search,
    }
    if (merged.services?.length) setSelectedServices(merged.services)
    if (merged.levels?.length) setSelectedLevels(merged.levels)
    if (merged.search) setSearch(merged.search)
    setFiltersBootstrapped(true)
  }, [consumePendingFilters, filtersBootstrapped, searchParams])

  const searchQuery = search.trim()
  const apiServices = selectedServices.length ? selectedServices : undefined
  const apiLevels = selectedLevels.length ? selectedLevels : undefined

  const { data, rawEntries, entries, loading, isRefreshing, error, refresh } = usePlatformLogs({
    services: apiServices,
    levels: apiLevels,
    search: searchQuery || undefined,
    range,
    limit: 1000,
  }, filtersBootstrapped, live)

  const visibleEntries = useMemo(
    () => sortLogEntries(entries, sortOrder),
    [entries, sortOrder],
  )

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null
    return rawEntries.find((entry) => entry.id === selectedEntryId) ?? pinnedEntry
  }, [pinnedEntry, rawEntries, selectedEntryId])

  const handleSelectEntry = useCallback((entry: PlatformLogEntry) => {
    setSelectedEntryId(entry.id)
    setPinnedEntry(entry)
  }, [])

  const handleCloseEntry = useCallback(() => {
    setSelectedEntryId(null)
    setPinnedEntry(null)
  }, [])

  useEffect(() => {
    if (!selectedEntryId) return
    const fresh = rawEntries.find((entry) => entry.id === selectedEntryId)
    if (fresh) setPinnedEntry(fresh)
  }, [rawEntries, selectedEntryId])

  useEffect(() => {
    if (!selectedEntryId) return
    const matchesFilters = applyLogFilters(rawEntries, {
      services: apiServices,
      levels: apiLevels,
      search: searchQuery || undefined,
    }).some((entry) => entry.id === selectedEntryId)
    if (!matchesFilters) {
      setSelectedEntryId(null)
      setPinnedEntry(null)
    }
  }, [apiLevels, apiServices, range, searchQuery, selectedEntryId])

  const facetBase = useMemo(
    () =>
      applyLogFilters(rawEntries, {
        services: apiServices,
        search: searchQuery || undefined,
      }),
    [apiServices, rawEntries, searchQuery],
  )

  const levelCounts = useMemo(() => countLevelsFromEntries(facetBase), [facetBase])
  const serviceOptions = useMemo(
    () => countServicesFromEntries(facetBase, data?.services?.map((service) => service.name) ?? []),
    [data?.services, facetBase],
  )
  const chartHistogram = useMemo(
    () => buildHistogramFromEntries(visibleEntries, range),
    [range, visibleEntries],
  )

  const metrics = useMemo(() => {
    const errors = visibleEntries.filter((entry) => entry.level === 'ERROR').length
    const warns = visibleEntries.filter((entry) => entry.level === 'WARN').length
    const total = visibleEntries.length
    const errorServices = new Set(visibleEntries.filter((e) => e.level === 'ERROR').map((e) => e.service)).size
    const errorRate = total ? Math.round((errors / total) * 1000) / 10 : 0
    const peakBucket = chartHistogram.reduce(
      (best, bucket) => {
        const sum = bucket.error + bucket.warn + bucket.info + bucket.debug + bucket.trace
        return sum > best.sum ? { sum } : best
      },
      { sum: 0 },
    )
    return { total, errors, warns, errorRate, errorServices, peakBucket: peakBucket.sum }
  }, [chartHistogram, visibleEntries])

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
    for (const service of selectedServices) {
      chips.push({
        key: `service-${service}`,
        label: `service:${service}`,
        onRemove: () => setSelectedServices((prev) => prev.filter((s) => s !== service)),
      })
    }
    for (const level of selectedLevels) {
      chips.push({
        key: `level-${level}`,
        label: `level:${level}`,
        onRemove: () => setSelectedLevels((prev) => prev.filter((l) => l !== level)),
      })
    }
    if (searchQuery) {
      chips.push({
        key: 'search',
        label: `search:"${searchQuery}"`,
        onRemove: () => setSearch(''),
      })
    }
    return chips
  }, [searchQuery, selectedLevels, selectedServices])

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(visibleEntries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `medicare-logs-${new Date().toISOString()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify.success(`Exported ${visibleEntries.length.toLocaleString()} log entries.`)
  }

  const handleRefresh = useCallback(() => {
    void refresh()
    notify.success('Log stream refreshed.')
  }, [refresh])

  const clearAllFilters = () => {
    setSelectedServices([])
    setSelectedLevels([])
    setSearch('')
  }

  const handleErrorsOnlyChange = (enabled: boolean) => {
    setSelectedLevels(enabled ? ['ERROR'] : [])
  }

  const statusLabel = metrics.errors > 0 ? 'Errors Detected' : live ? 'Live Stream' : 'Paused'
  const statusColor = metrics.errors > 0 ? LOG_LEVEL_COLORS.ERROR : '#10b981'

  return (
    <ObservabilityPage>
      <PageMotion motionKey="logs">
      <MotionHeader>
      <AdvancedPageHeader
        title="Log Explorer"
        eyebrow="Observability / Logs"
        description="Structured logs with readable summaries and a JSON inspector panel."
        icon={FileText}
        color="#06b6d4"
        status={statusLabel}
        compact
      >
        <PbiGrid spacing={1}>
          <MotionMetricGridItem index={0} size={{ xs: 6, sm: 4, md: 2.4 }}><CommandMetric label="Total Events" value={metrics.total.toLocaleString()} helper={`Window: ${range}`} color="#06b6d4" icon={ScrollText} /></MotionMetricGridItem>
          <MotionMetricGridItem index={1} size={{ xs: 6, sm: 4, md: 2.4 }}><CommandMetric label="Errors" value={metrics.errors.toLocaleString()} helper={metrics.errors ? 'ERROR level only' : 'Clear'} color="#ef4444" icon={Siren} /></MotionMetricGridItem>
          <MotionMetricGridItem index={2} size={{ xs: 6, sm: 4, md: 2.4 }}><CommandMetric label="Warnings" value={metrics.warns.toLocaleString()} helper="WARN level" color="#f59e0b" icon={AlertTriangle} /></MotionMetricGridItem>
          <MotionMetricGridItem index={3} size={{ xs: 6, sm: 4, md: 2.4 }}><CommandMetric label="Error Rate" value={`${metrics.errorRate}%`} helper={`${metrics.errorServices} services`} color="#f97316" icon={Zap} /></MotionMetricGridItem>
          <MotionMetricGridItem index={4} size={{ xs: 6, sm: 4, md: 2.4 }}><CommandMetric label="Peak Bucket" value={metrics.peakBucket.toLocaleString()} helper="Max / interval" color="#8b5cf6" icon={FileText} /></MotionMetricGridItem>
        </PbiGrid>
      </AdvancedPageHeader>
      </MotionHeader>

      {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}
      {data?.warning && <Alert severity="warning" sx={{ flexShrink: 0 }}>{data.warning}</Alert>}

      <MotionPanel index={0}>
      <LogsChartsRow histogram={chartHistogram} levels={levelCounts} />
      </MotionPanel>

      <MotionPanel index={1}>
      <AdvancedPanel
        title="Log Stream"
        caption={`${visibleEntries.length.toLocaleString()} events · ${data?.source ?? 'unknown'} source · filtered by log level`}
        dense
        bodySx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={showLiveStream ? 'Hide tail' : 'Show tail'}
              size="small"
              variant="outlined"
              onClick={() => setShowLiveStream((v) => !v)}
              sx={{ height: 22, fontSize: 10, cursor: 'pointer' }}
            />
            <StatusDot color={statusColor} />
            <Chip
              label={live ? 'LIVE' : 'PAUSED'}
              size="small"
              sx={{ height: 22, fontSize: 10, fontWeight: 700, bgcolor: alpha(statusColor, 0.12), color: statusColor }}
            />
          </Box>
        }
      >
        <Box sx={{ px: 1.5, pt: 1, flexShrink: 0 }}>
          <MotionToolbar>
          <LogsToolbar
            search={search}
            range={range}
            live={live}
            loading={loading}
            isRefreshing={isRefreshing}
            sortOrder={sortOrder}
            density={density}
            errorsOnly={errorsOnly}
            source={data?.source}
            onSearchChange={setSearch}
            onRangeChange={setRange}
            onLiveChange={setLive}
            onSortOrderChange={setSortOrder}
            onDensityChange={setDensity}
            onErrorsOnlyChange={handleErrorsOnlyChange}
            onRefresh={handleRefresh}
            onDownload={handleDownload}
          />
          </MotionToolbar>
        </Box>

        <LogsFilterHeader
          services={serviceOptions}
          levelCounts={levelCounts}
          selectedServices={selectedServices}
          selectedLevels={selectedLevels}
          onServicesChange={setSelectedServices}
          onLevelsChange={setSelectedLevels}
        />

        <LogsFilterBar filters={filterChips} onClearAll={clearAllFilters} />

        <Box
          sx={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            borderTop: 1,
            borderColor: 'divider',
            flexDirection: { xs: 'column', lg: 'row' },
            overflow: { xs: 'auto', lg: 'hidden' },
            alignItems: { lg: 'stretch' },
          }}
        >
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
            {showLiveStream && (
              <Box sx={{ flexShrink: 0 }}>
                <LiveLogsStream
                  entries={visibleEntries}
                  live={live}
                  onSelect={handleSelectEntry}
                  selectedId={selectedEntryId}
                />
              </Box>
            )}

            {metrics.errors > 0 && (
              <Box
                sx={{
                  px: 1.5,
                  py: 0.6,
                  borderBottom: 1,
                  borderColor: alpha(LOG_LEVEL_COLORS.ERROR, 0.2),
                  bgcolor: alpha(LOG_LEVEL_COLORS.ERROR, 0.05),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexShrink: 0,
                }}
              >
                <Siren size={14} color={LOG_LEVEL_COLORS.ERROR} />
                <Typography sx={{ fontSize: 12, color: LOG_LEVEL_COLORS.ERROR, fontWeight: 600 }}>
                  {metrics.errors} ERROR-level event{metrics.errors === 1 ? '' : 's'} in view
                </Typography>
              </Box>
            )}

            {errorsOnly && metrics.errors === 0 && visibleEntries.length > 0 && (
              <Box sx={{ px: 1.5, py: 0.6, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  No ERROR-level logs in this window. Warnings (4xx) are WARN level — use the WARN filter to inspect them.
                </Typography>
              </Box>
            )}

            <LogsTable
              entries={visibleEntries}
              selectedId={selectedEntryId}
              density={density}
              onSelect={handleSelectEntry}
            />
          </Box>

          <LogDetailPanel entry={selectedEntry} onClose={handleCloseEntry} />
        </Box>
      </AdvancedPanel>
      </MotionPanel>
      </PageMotion>
    </ObservabilityPage>
  )
}
