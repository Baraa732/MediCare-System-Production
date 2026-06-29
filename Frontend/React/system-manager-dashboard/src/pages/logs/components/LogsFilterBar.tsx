import { Box, Chip, IconButton } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { X } from 'lucide-react'

interface LogsFilterBarProps {
  filters: Array<{ key: string; label: string; onRemove: () => void }>
  onClearAll: () => void
}

export default function LogsFilterBar({ filters, onClearAll }: LogsFilterBarProps) {
  const theme = useTheme()

  if (!filters.length) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.75,
        px: 1.5,
        py: 0.85,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.55),
      }}
    >
      {filters.map((filter) => (
        <Chip
          key={filter.key}
          label={filter.label}
          size="small"
          onDelete={filter.onRemove}
          deleteIcon={<X size={12} />}
          sx={{
            height: 24,
            fontSize: 11,
            fontFamily: theme.typography.mono?.fontFamily,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
            '& .MuiChip-deleteIcon': { fontSize: 14, color: 'text.secondary' },
          }}
        />
      ))}
      <IconButton
        size="small"
        onClick={onClearAll}
        sx={{ ml: 'auto', fontSize: 11, color: 'text.secondary', borderRadius: '4px', px: 1 }}
      >
        Clear all
      </IconButton>
    </Box>
  )
}
