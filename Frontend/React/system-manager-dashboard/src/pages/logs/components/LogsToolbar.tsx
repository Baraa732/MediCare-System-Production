import {
  Box,
  Button,
  FormControl,
  InputAdornment,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import {
  ArrowDownWideNarrow,
  Download,
  List,
  RefreshCw,
  Search,
  Siren,
} from 'lucide-react'
import { LOG_SORT_OPTIONS, TIME_RANGES, type LogSortOrder, type LogViewDensity } from '../logUtils'

interface LogsToolbarProps {
  search: string
  range: string
  live: boolean
  loading: boolean
  isRefreshing?: boolean
  sortOrder: LogSortOrder
  density: LogViewDensity
  errorsOnly: boolean
  source?: string
  onSearchChange: (value: string) => void
  onRangeChange: (value: string) => void
  onLiveChange: (value: boolean) => void
  onSortOrderChange: (value: LogSortOrder) => void
  onDensityChange: (value: LogViewDensity) => void
  onErrorsOnlyChange: (value: boolean) => void
  onRefresh: () => void
  onDownload: () => void
}

export default function LogsToolbar({
  search,
  range,
  live,
  loading,
  isRefreshing = false,
  sortOrder,
  density,
  errorsOnly,
  source,
  onSearchChange,
  onRangeChange,
  onLiveChange,
  onSortOrderChange,
  onDensityChange,
  onErrorsOnlyChange,
  onRefresh,
  onDownload,
}: LogsToolbarProps) {
  const theme = useTheme()
  const accent = theme.palette.primary.main
  const busy = loading || isRefreshing

  return (
    <div className="logs-toolbar-row">
      <TextField
        size="small"
        placeholder="Search message, service, trace…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{
          flex: 1,
          minWidth: { xs: '100%', sm: 220 },
          maxWidth: 420,
          '& .MuiOutlinedInput-root': { height: 32, fontSize: 12, borderRadius: '6px' },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={14} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          },
        }}
      />

      {source && (
        <Typography variant="caption2" sx={{ px: 0.75, py: 0.25, borderRadius: '4px', bgcolor: alpha(accent, 0.1), color: accent, fontWeight: 700, fontSize: 10 }}>
          {source.toUpperCase()}
        </Typography>
      )}

      <FormControl size="small" sx={{ minWidth: 96 }}>
        <Select value={range} onChange={(e) => onRangeChange(e.target.value)} sx={{ fontSize: 11, height: 32 }}>
          {TIME_RANGES.map((item) => (
            <MenuItem key={item.value} value={item.value} sx={{ fontSize: 11 }}>{item.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, border: 1, borderColor: live ? alpha(accent, 0.35) : 'divider', borderRadius: '6px', height: 32 }}>
        <Switch size="small" checked={live} onChange={(e) => onLiveChange(e.target.checked)} />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: live ? 'primary.main' : 'text.secondary' }}>
          {live ? 'LIVE' : 'OFF'}
        </Typography>
      </Box>

      <FormControl size="small" sx={{ minWidth: 110 }}>
        <Select
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value as LogSortOrder)}
          sx={{ fontSize: 11, height: 32 }}
        >
          {LOG_SORT_OPTIONS.map((item) => (
            <MenuItem key={item.value} value={item.value} sx={{ fontSize: 11 }}>{item.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={density}
        onChange={(_, value: LogViewDensity | null) => value && onDensityChange(value)}
        sx={{ height: 32, '& .MuiToggleButton-root': { px: 0.75, py: 0, fontSize: 10 } }}
      >
        <ToggleButton value="compact">
          <Tooltip title="Compact rows"><List size={13} /></Tooltip>
        </ToggleButton>
        <ToggleButton value="comfortable">
          <Tooltip title="Expanded rows"><ArrowDownWideNarrow size={13} /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Button
        size="small"
        variant={errorsOnly ? 'contained' : 'outlined'}
        color={errorsOnly ? 'error' : 'inherit'}
        onClick={() => onErrorsOnlyChange(!errorsOnly)}
        sx={{ height: 32, minWidth: 32, px: 1, fontSize: 10 }}
      >
        <Siren size={13} />
      </Button>

      <Button size="small" variant="outlined" onClick={onRefresh} disabled={loading} sx={{ height: 32, fontSize: 10, px: 1 }}>
        <RefreshCw size={13} className={busy ? 'spin' : ''} />
      </Button>
      <Button size="small" variant="outlined" onClick={onDownload} sx={{ height: 32, fontSize: 10, px: 1 }}>
        <Download size={13} />
      </Button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  )
}
