import { Chip, FormControl, MenuItem, Select } from '@mui/material'
import { alpha } from '@mui/material/styles'
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
  const countMap = new Map(levelCounts.map((l) => [l.level, l.count]))

  const isLevelIncluded = (level: PlatformLogLevel) =>
    selectedLevels.length === 0 || selectedLevels.includes(level)

  const isLevelExclusive = (level: PlatformLogLevel) =>
    selectedLevels.length === 1 && selectedLevels[0] === level

  return (
    <div className="logs-filter-row">
      {ALL_LOG_LEVELS.map((level) => {
        const count = countMap.get(level) ?? 0
        const included = isLevelIncluded(level)
        const exclusive = isLevelExclusive(level)
        return (
          <Chip
            key={level}
            label={`${level}${count ? ` ${formatCount(count)}` : ''}`}
            size="small"
            onClick={() => toggleLevelChip(level, selectedLevels, onLevelsChange)}
            sx={{
              height: 24,
              fontSize: 10,
              fontWeight: 700,
              color: LOG_LEVEL_COLORS[level],
              bgcolor: exclusive
                ? alpha(LOG_LEVEL_COLORS[level], 0.18)
                : included
                  ? alpha(LOG_LEVEL_COLORS[level], 0.08)
                  : 'transparent',
              border: `1px solid ${alpha(LOG_LEVEL_COLORS[level], exclusive ? 0.55 : included ? 0.3 : 0.18)}`,
              opacity: included ? 1 : 0.5,
            }}
          />
        )
      })}

      <FormControl size="small" sx={{ minWidth: 140, maxWidth: 220, ml: 'auto' }}>
        <Select
          multiple
          displayEmpty
          value={selectedServices}
          onChange={(e) => {
            const value = e.target.value
            onServicesChange(typeof value === 'string' ? value.split(',') : value)
          }}
          renderValue={(selected) => {
            if (!selected.length) return 'All services'
            if (selected.length === 1) return selected[0].replace(/-service$/, '')
            return `${selected.length} services`
          }}
          sx={{ fontSize: 11, height: 28, borderRadius: '6px' }}
        >
          {services.map((service) => (
            <MenuItem key={service.name} value={service.name} sx={{ fontSize: 11 }}>
              {service.name.replace(/-service$/, '')} ({formatCount(service.count)})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {(selectedServices.length > 0 || selectedLevels.length > 0) && (
        <Chip
          label="Clear"
          size="small"
          variant="outlined"
          onClick={() => {
            onServicesChange([])
            onLevelsChange([])
          }}
          sx={{ height: 24, fontSize: 10 }}
        />
      )}
    </div>
  )
}
