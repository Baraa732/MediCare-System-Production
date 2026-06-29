import { Box, Chip, FormControl, MenuItem, Select, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { PlatformLogLevel } from '../../../api/types'
import { ALL_LOG_LEVELS, LOG_LEVEL_COLORS, formatCount } from '../logUtils'

interface LogsFilterHeaderProps {
  services: Array<{ name: string; count: number }>
  levelCounts: Array<{ level: PlatformLogLevel; count: number }>
  selectedServices: string[]
  selectedLevels: PlatformLogLevel[]
  onServicesChange: (services: string[]) => void
  onLevelsChange: (levels: PlatformLogLevel[]) => void
}

/** Toggle a level in the filter set. Empty set = show all levels. */
function toggleLevelChip(
  level: PlatformLogLevel,
  selected: PlatformLogLevel[],
  onChange: (next: PlatformLogLevel[]) => void,
) {
  if (selected.length === 0) {
    onChange([level])
    return
  }
  if (selected.includes(level)) {
    onChange(selected.filter((item) => item !== level))
    return
  }
  onChange([...selected, level])
}

export default function LogsFilterHeader({
  services,
  levelCounts,
  selectedServices,
  selectedLevels,
  onServicesChange,
  onLevelsChange,
}: LogsFilterHeaderProps) {
  const theme = useTheme()
  const countMap = new Map(levelCounts.map((l) => [l.level, l.count]))

  const isLevelIncluded = (level: PlatformLogLevel) =>
    selectedLevels.length === 0 || selectedLevels.includes(level)

  const isLevelExclusive = (level: PlatformLogLevel) =>
    selectedLevels.length === 1 && selectedLevels[0] === level

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        gap: 1.25,
        flexShrink: 0,
      }}
    >
      <Box sx={{ minWidth: { md: 100 } }}>
        <Typography variant="caption2" sx={{ color: 'text.disabled', fontWeight: 700, letterSpacing: '0.05em' }}>
          QUICK FILTERS
        </Typography>
        <Typography variant="caption2" sx={{ color: 'text.disabled', display: 'block', fontSize: 10, mt: 0.25 }}>
          {selectedLevels.length === 0 ? 'All levels' : `${selectedLevels.join(', ')} only`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
        {ALL_LOG_LEVELS.map((level) => {
          const count = countMap.get(level) ?? 0
          const included = isLevelIncluded(level)
          const exclusive = isLevelExclusive(level)
          return (
            <Chip
              key={level}
              label={`${level}${count ? ` · ${formatCount(count)}` : ''}`}
              size="small"
              onClick={() => toggleLevelChip(level, selectedLevels, onLevelsChange)}
              sx={{
                height: 26,
                fontSize: 11,
                fontWeight: 700,
                color: LOG_LEVEL_COLORS[level],
                bgcolor: exclusive
                  ? alpha(LOG_LEVEL_COLORS[level], 0.18)
                  : included
                    ? alpha(LOG_LEVEL_COLORS[level], 0.08)
                    : 'transparent',
                border: `1px solid ${alpha(LOG_LEVEL_COLORS[level], exclusive ? 0.55 : included ? 0.3 : 0.18)}`,
                opacity: included ? 1 : 0.55,
                '&:hover': { bgcolor: alpha(LOG_LEVEL_COLORS[level], 0.12), opacity: 1 },
              }}
            />
          )
        })}
      </Box>

      <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 200 }, maxWidth: 280 }}>
        <Select
          multiple
          displayEmpty
          value={selectedServices}
          onChange={(e) => {
            const value = e.target.value
            onServicesChange(typeof value === 'string' ? value.split(',') : value)
          }}
          renderValue={(selected) => {
            if (!selected.length) return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>All services</Typography>
            if (selected.length === 1) return selected[0]
            return `${selected.length} services`
          }}
          sx={{ fontSize: 12, borderRadius: '6px', bgcolor: 'background.default' }}
        >
          {services.map((service) => (
            <MenuItem key={service.name} value={service.name} sx={{ fontSize: 12 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                <span>{service.name}</span>
                <Typography component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>
                  {formatCount(service.count)}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {(selectedServices.length > 0 || selectedLevels.length > 0) && (
        <Chip
          label="Show all"
          size="small"
          variant="outlined"
          onClick={() => {
            onServicesChange([])
            onLevelsChange([])
          }}
          sx={{ height: 26, fontSize: 11, alignSelf: { xs: 'flex-start', md: 'center' } }}
        />
      )}
    </Box>
  )
}
