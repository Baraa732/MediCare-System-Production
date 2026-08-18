import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { ChevronDown, Filter, Search } from 'lucide-react'
import type { PlatformLogLevel } from '../../../api/types'
import { ALL_LOG_LEVELS, LOG_LEVEL_COLORS, formatCount } from '../logUtils'

interface LogsSidebarProps {
  services: Array<{ name: string; count: number }>
  levels: Array<{ level: PlatformLogLevel; count: number }>
  selectedServices: string[]
  selectedLevels: PlatformLogLevel[]
  onServicesChange: (services: string[]) => void
  onLevelsChange: (levels: PlatformLogLevel[]) => void
}

function toggleFacet<T extends string>(
  name: T,
  selected: T[],
  allNames: T[],
  onChange: (next: T[]) => void,
) {
  if (selected.length === 0) {
    onChange(allNames.filter((item) => item !== name))
    return
  }

  if (selected.includes(name)) {
    onChange(selected.filter((item) => item !== name))
    return
  }

  const next = [...selected, name]
  if (next.length >= allNames.length) {
    onChange([])
  } else {
    onChange(next)
  }
}

export default function LogsSidebar({
  services,
  levels,
  selectedServices,
  selectedLevels,
  onServicesChange,
  onLevelsChange,
}: LogsSidebarProps) {
  const theme = useTheme()
  const [serviceQuery, setServiceQuery] = useState('')
  const levelCounts = new Map(levels.map((l) => [l.level, l.count]))
  const allServiceNames = services.map((s) => s.name)
  const allLevelNames = ALL_LOG_LEVELS

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) => s.name.toLowerCase().includes(q))
  }, [serviceQuery, services])

  const isServiceChecked = (name: string) =>
    selectedServices.length === 0 || selectedServices.includes(name)

  const isLevelChecked = (level: PlatformLogLevel) =>
    selectedLevels.length === 0 || selectedLevels.includes(level)

  return (
    <Box
      sx={{
        width: { xs: '100%', md: 280 },
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.88),
        overflowY: 'auto',
        p: 1.25,
        backdropFilter: 'blur(6px)',
        backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 120px)`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25, px: 0.25 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            color: theme.palette.primary.main,
          }}
        >
          <Filter size={14} />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            Advanced Filters
          </Typography>
          <Typography variant="caption2" sx={{ color: 'text.disabled' }}>
            Facet by service & severity
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.25 }}>
        {ALL_LOG_LEVELS.map((level) => {
          const active = isLevelChecked(level) && selectedLevels.length > 0
          const count = levelCounts.get(level) ?? 0
          return (
            <Button
              key={level}
              size="small"
              onClick={() => toggleFacet(level, selectedLevels, [...allLevelNames], onLevelsChange)}
              sx={{
                minWidth: 0,
                px: 0.9,
                py: 0.2,
                fontSize: 10,
                fontWeight: 700,
                borderRadius: '999px',
                color: LOG_LEVEL_COLORS[level],
                border: `1px solid ${alpha(LOG_LEVEL_COLORS[level], active ? 0.55 : 0.25)}`,
                bgcolor: active ? alpha(LOG_LEVEL_COLORS[level], 0.14) : 'transparent',
                boxShadow: active ? `0 0 12px ${alpha(LOG_LEVEL_COLORS[level], 0.2)}` : 'none',
              }}
            >
              {level} {count ? `· ${formatCount(count)}` : ''}
            </Button>
          )
        })}
      </Box>

      <Accordion
        defaultExpanded
        disableGutters
        elevation={0}
        sx={{ bgcolor: 'transparent', '&:before': { display: 'none' }, mb: 0.75 }}
      >
        <AccordionSummary expandIcon={<ChevronDown size={14} />} sx={{ minHeight: 34, px: 0.25, borderRadius: '6px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              SERVICES
            </Typography>
            <Button size="small" sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: 10 }} onClick={(e) => { e.stopPropagation(); onServicesChange([]) }}>
              Reset
            </Button>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0 }}>
          <TextField
            size="small"
            placeholder="Filter services…"
            value={serviceQuery}
            onChange={(e) => setServiceQuery(e.target.value)}
            fullWidth
            sx={{ mb: 0.75, '& .MuiOutlinedInput-root': { fontSize: 12, bgcolor: 'background.default' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={13} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box sx={{ maxHeight: 240, overflowY: 'auto', pr: 0.25 }}>
            {filteredServices.map((service) => {
              const checked = isServiceChecked(service.name)
              return (
                <Box
                  key={service.name}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 32,
                    borderRadius: '6px',
                    transition: 'background-color 0.15s ease, transform 0.15s ease',
                    bgcolor: checked && selectedServices.length ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': { bgcolor: 'background.hover', transform: 'translateX(2px)' },
                  }}
                >
                  <FormControlLabel
                    sx={{ flex: 1, mx: 0, px: 0.5 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={() =>
                          toggleFacet(service.name, selectedServices, allServiceNames, onServicesChange)
                        }
                      />
                    }
                    label={
                      <Typography variant="caption2" sx={{ fontSize: 12, fontFamily: theme.typography.mono?.fontFamily }}>
                        {service.name}
                      </Typography>
                    }
                  />
                  <Typography variant="caption2" sx={{ color: 'text.disabled', pr: 0.5, fontFamily: theme.typography.mono?.fontFamily }}>
                    {formatCount(service.count)}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ChevronDown size={14} />} sx={{ minHeight: 34, px: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              LEVELS
            </Typography>
            <Button size="small" sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: 10 }} onClick={(e) => { e.stopPropagation(); onLevelsChange([]) }}>
              Reset
            </Button>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0 }}>
          {ALL_LOG_LEVELS.map((level) => {
            const checked = isLevelChecked(level)
            const count = levelCounts.get(level) ?? 0
            return (
              <Box
                key={level}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 32,
                  borderRadius: '6px',
                  bgcolor: checked && selectedLevels.length ? alpha(LOG_LEVEL_COLORS[level], 0.08) : 'transparent',
                  '&:hover': { bgcolor: 'background.hover' },
                }}
              >
                <FormControlLabel
                  sx={{ flex: 1, mx: 0, px: 0.5 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={checked}
                      onChange={() =>
                        toggleFacet(level, selectedLevels, [...allLevelNames], onLevelsChange)
                      }
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: LOG_LEVEL_COLORS[level],
                          boxShadow: count ? `0 0 10px ${alpha(LOG_LEVEL_COLORS[level], 0.55)}` : 'none',
                        }}
                      />
                      <Typography variant="caption2" sx={{ fontSize: 12 }}>
                        {level}
                      </Typography>
                    </Box>
                  }
                />
                <Typography variant="caption2" sx={{ color: LOG_LEVEL_COLORS[level], pr: 0.5, fontWeight: count ? 700 : 400 }}>
                  {formatCount(count)}
                </Typography>
              </Box>
            )
          })}
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
