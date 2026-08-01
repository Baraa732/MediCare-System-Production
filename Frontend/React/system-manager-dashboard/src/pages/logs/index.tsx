import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { FileText } from 'lucide-react'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage } from '../../components/advanced/AdvancedPage'
import { MotionHeader, MotionPanel } from '../../components/motion/AnimatedSections'
import { PageMotion } from '../../components/motion/PageMotion'
import { usePlatformLogs } from '../../hooks/usePlatformLogs'
import { notify } from '../../lib/toast'
import { parseLogsSearchParams, useLogsFilterStore } from '../../store/logsFilterStore'
import type { PlatformLogEntry, PlatformLogLevel } from '../../api/types'
import LogDetailPanel from './components/LogDetailPanel'
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
import './logs.css'

const LogsChartsRow = lazy(() => import('./components/LogsChartsRow'))

export default function LogsPage() {
  const [searchParams] = useSearchParams()
  const consumePendingFilters = useLogsFilterStore((s) => s.consumePendingFilters)

  const [search, setSearch] = useState('')
  const [range, setRange] = useState('1h')
  const [live, setLive] = useState(true)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<PlatformLogLevel[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [pinnedEntry, setPinnedEntry] = useState<PlatformLogEntry | null>(null)
  const [filtersBootstrapped, setFiltersBootstrapped] = useState(false)
  const [sortOrder, setSortOrder] = useState<LogSortOrder>('newest')
  const [density, setDensity] = useState<LogViewDensity>('compact')

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
  const hasClientFilters = Boolean(apiServices?.length || apiLevels?.length || searchQuery)

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
  }, [apiLevels, apiServices, range, searchQuery, rawEntries, selectedEntryId])

  const facetBase = useMemo(
    () =>
      applyLogFilters(rawEntries, {
        services: apiServices,
        search: searchQuery || undefined,
      }),
    [apiServices, rawEntries, searchQuery],
  )

  const levelCounts = useMemo(() => {
    if (!hasClientFilters && data?.levels?.length) {
      return data.levels.map((item) => ({
        level: item.level as PlatformLogLevel,
        count: item.count,
      }))
    }
    return countLevelsFromEntries(facetBase)
  }, [data?.levels, facetBase, hasClientFilters])

  const serviceOptions = useMemo(
    () => countServicesFromEntries(facetBase, data?.services?.map((service) => service.name) ?? []),
    [data?.services, facetBase],
  )

  const chartHistogram = useMemo(() => {
    if (!hasClientFilters && data?.histogram?.length) return data.histogram
    return buildHistogramFromEntries(visibleEntries, range)
  }, [data?.histogram, hasClientFilters, range, visibleEntries])

  const metrics = useMemo(() => {
    const errors = visibleEntries.filter((entry) => entry.level === 'ERROR').length
    const warns = visibleEntries.filter((entry) => entry.level === 'WARN').length
    const total = visibleEntries.length
    const errorServices = new Set(visibleEntries.filter((e) => e.level === 'ERROR').map((e) => e.service)).size
    const errorRate = total ? Math.round((errors / total) * 1000) / 10 : 0
    return { total, errors, warns, errorRate, errorServices }
  }, [visibleEntries])

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
    for (const service of selectedServices) {
      chips.push({
        key: `service-${service}`,
        label: service.replace(/-service$/, ''),
        onRemove: () => setSelectedServices((prev) => prev.filter((s) => s !== service)),
      })
    }
    for (const level of selectedLevels) {
      chips.push({
        key: `level-${level}`,
        label: level,
        onRemove: () => setSelectedLevels((prev) => prev.filter((l) => l !== level)),
      })
    }
    if (searchQuery) {
      chips.push({
        key: 'search',
        label: `"${searchQuery}"`,
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
    notify.success(`Exported ${visibleEntries.length.toLocaleString()} entries.`)
  }

  const handleRefresh = useCallback(() => {
    void refresh()
  }, [refresh])

  const clearAllFilters = () => {
    setSelectedServices([])
    setSelectedLevels([])
    setSearch('')
  }

  const handleErrorsOnlyChange = (enabled: boolean) => {
    setSelectedLevels(enabled ? ['ERROR'] : [])
  }

  const statusLabel = metrics.errors > 0 ? `${metrics.errors} errors` : live ? 'Live' : 'Paused'
  const statusColor = metrics.errors > 0 ? LOG_LEVEL_COLORS.ERROR : '#10b981'

  return (
    <ObservabilityPage>
      <PageMotion motionKey="logs">
        <div className="logs-page">
          <MotionHeader>
            <AdvancedPageHeader
              title="Logs"
              eyebrow=""
              description=""
              icon={FileText}
              color="#06b6d4"
              status={statusLabel}
              compact
              actions={
                <div className="logs-stats">
                  <div className="logs-stat">
                    <span className="logs-stat__value" style={{ color: '#06b6d4' }}>{metrics.total.toLocaleString()}</span>
                    <span className="logs-stat__label">{range} total</span>
                  </div>
                  <div className="logs-stat">
                    <span className="logs-stat__value" style={{ color: LOG_LEVEL_COLORS.ERROR }}>{metrics.errors}</span>
                    <span className="logs-stat__label">errors</span>
                  </div>
                  <div className="logs-stat">
                    <span className="logs-stat__value" style={{ color: LOG_LEVEL_COLORS.WARN }}>{metrics.warns}</span>
                    <span className="logs-stat__label">warnings</span>
                  </div>
                  <div className="logs-stat">
                    <span className="logs-stat__value">{metrics.errorRate}%</span>
                    <span className="logs-stat__label">error rate</span>
                  </div>
                  <div className="logs-stat">
                    <span className="logs-stat__value">{metrics.errorServices}</span>
                    <span className="logs-stat__label">svc w/ errors</span>
                  </div>
                </div>
              }
            />
          </MotionHeader>

          {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}
          {data?.warning && <Alert severity="warning" sx={{ flexShrink: 0 }}>{data.warning}</Alert>}

          <MotionPanel index={0}>
            <Suspense fallback={<Box sx={{ height: 160, borderRadius: 1, bgcolor: 'action.hover' }} />}>
              <LogsChartsRow histogram={chartHistogram} levels={levelCounts} totalEvents={metrics.total} />
            </Suspense>
          </MotionPanel>

          <MotionPanel index={1}>
            <AdvancedPanel
              title="Stream"
              caption={`${visibleEntries.length.toLocaleString()} events`}
              dense
              bodySx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
              actions={
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: statusColor,
                    boxShadow: live ? `0 0 8px ${alpha(statusColor, 0.6)}` : 'none',
                  }}
                />
              }
            >
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
                  flexDirection: { xs: 'column', lg: 'row' },
                  overflow: { xs: 'auto', lg: 'hidden' },
                }}
              >
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
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
        </div>
      </PageMotion>
    </ObservabilityPage>
  )
}
