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
  ArrowUpWideNarrow,
  Download,
  LayoutList,
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          size="small"
          placeholder="Search message, service, trace ID, or JSON payload…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{
            flex: 1,
            minWidth: { xs: '100%', md: 360 },
            maxWidth: 560,
            '& .MuiOutlinedInput-root': {
              bgcolor: alpha(theme.palette.background.default, 0.75),
              borderRadius: '6px',
              transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${alpha(accent, 0.15)}`,
              },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={15} color={theme.palette.text.secondary} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {source && (
            <Typography
              variant="caption2"
              sx={{
                px: 1,
                py: 0.35,
                borderRadius: '4px',
                bgcolor: alpha(accent, 0.1),
                color: accent,
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.04em',
              }}
            >
              {source.toUpperCase()}
            </Typography>
          )}

          <FormControl size="small" sx={{ minWidth: 118 }}>
            <Select value={range} onChange={(e) => onRangeChange(e.target.value)} sx={{ fontSize: 12, borderRadius: '6px' }}>
              {TIME_RANGES.map((item) => (
                <MenuItem key={item.value} value={item.value} sx={{ fontSize: 12 }}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: '6px',
              border: 1,
              borderColor: live ? alpha(accent, 0.4) : 'divider',
              bgcolor: live ? alpha(accent, 0.08) : 'transparent',
              boxShadow: live ? `0 0 16px ${alpha(accent, 0.12)}` : 'none',
            }}
          >
            <Switch size="small" checked={live} onChange={(e) => onLiveChange(e.target.checked)} />
            <Typography variant="caption2" sx={{ color: live ? 'primary.main' : 'text.secondary', fontWeight: live ? 700 : 500, fontSize: 11 }}>
              {live ? 'LIVE' : 'PAUSED'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 132 }}>
            <Select
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value as LogSortOrder)}
              sx={{ fontSize: 12, borderRadius: '6px' }}
              startAdornment={
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  {sortOrder === 'newest' ? <ArrowDownWideNarrow size={13} /> : <ArrowUpWideNarrow size={13} />}
                </InputAdornment>
              }
            >
              {LOG_SORT_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value} sx={{ fontSize: 12 }}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={density}
            onChange={(_, value: LogViewDensity | null) => value && onDensityChange(value)}
            sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.35, fontSize: 11, borderRadius: '6px !important' } }}
          >
            <ToggleButton value="comfortable">
              <Tooltip title="Comfortable rows">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LayoutList size={13} />
                  <span>Comfort</span>
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="compact">
              <Tooltip title="Compact rows">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <List size={13} />
                  <span>Compact</span>
                </Box>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant={errorsOnly ? 'contained' : 'outlined'}
            color={errorsOnly ? 'error' : 'inherit'}
            startIcon={<Siren size={13} />}
            onClick={() => onErrorsOnlyChange(!errorsOnly)}
            sx={{
              height: 30,
              fontSize: 11,
              borderRadius: '6px',
              ...(errorsOnly && { boxShadow: `0 0 18px ${alpha(theme.palette.error.main, 0.25)}` }),
            }}
          >
            Errors only
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw size={14} className={busy ? 'spin' : ''} />}
            onClick={onRefresh}
            disabled={loading}
            sx={{
              height: 30,
              fontSize: 11,
              borderRadius: '6px',
              '& .spin': { animation: 'spin 1s linear infinite' },
              '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
            }}
          >
            Refresh
          </Button>
          <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={onDownload} sx={{ height: 30, fontSize: 11, borderRadius: '6px' }}>
            Export JSON
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
