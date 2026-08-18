import type { SxProps, Theme } from '@mui/material/styles'

/** Shared dark-console field chrome for activation forms. */
export const consoleFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: 'var(--ac-panel)',
    color: 'var(--ac-text)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    '& fieldset': {
      borderColor: 'rgba(125, 211, 252, 0.18)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(34, 211, 238, 0.45)',
    },
    '&.Mui-focused': {
      bgcolor: 'var(--ac-panel-2)',
      boxShadow: '0 0 0 3px rgba(34, 211, 238, 0.14)',
      '& fieldset': {
        borderColor: '#22d3ee',
        borderWidth: '1px',
      },
    },
    '&.Mui-error fieldset': {
      borderColor: 'rgba(251, 113, 133, 0.7)',
    },
  },
  '& .MuiInputBase-input': {
    color: 'var(--ac-text)',
    fontSize: 14,
    fontWeight: 500,
    '&::placeholder': {
      color: '#64748b',
      opacity: 1,
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--ac-muted)',
    fontWeight: 600,
    '&.Mui-focused': {
      color: '#67e8f9',
    },
    '&.Mui-error': {
      color: '#fb7185',
    },
  },
  '& .MuiFormHelperText-root': {
    color: 'var(--ac-muted)',
    marginLeft: '2px',
    '&.Mui-error': {
      color: '#fb7185',
    },
  },
  '& .MuiSelect-icon': {
    color: 'var(--ac-muted)',
  },
  '& input[type="date"]::-webkit-calendar-picker-indicator': {
    filter: 'invert(0.75)',
    opacity: 0.7,
    cursor: 'pointer',
  },
}

export const consoleAutocompleteSx: SxProps<Theme> = {
  ...consoleFieldSx,
  '& .MuiChip-root': {
    bgcolor: 'rgba(34, 211, 238, 0.14)',
    color: '#a5f3fc',
    border: '1px solid rgba(34, 211, 238, 0.28)',
    borderRadius: '8px',
    height: 26,
    fontWeight: 650,
    '& .MuiChip-deleteIcon': {
      color: '#67e8f9',
      opacity: 0.8,
      '&:hover': { color: '#ecfeff', opacity: 1 },
    },
  },
}

export const consoleMenuProps = {
  slotProps: {
    paper: {
      sx: {
        mt: 0.75,
        borderRadius: '12px',
        bgcolor: 'var(--ac-panel)',
        color: 'var(--ac-text)',
        border: '1px solid rgba(125, 211, 252, 0.16)',
        backgroundImage: 'none',
        boxShadow: '0 18px 40px -20px rgba(0,0,0,0.65)',
        '& .MuiMenuItem-root': {
          fontSize: 13.5,
          fontWeight: 550,
          borderRadius: '8px',
          mx: 0.5,
          '&:hover': { bgcolor: 'rgba(34, 211, 238, 0.1)' },
          '&.Mui-selected': {
            bgcolor: 'rgba(34, 211, 238, 0.16)',
            '&:hover': { bgcolor: 'rgba(34, 211, 238, 0.22)' },
          },
        },
      },
    },
  },
}

export const consoleCheckboxSx: SxProps<Theme> = {
  color: '#64748b',
  '&.Mui-checked': { color: '#22d3ee' },
}

export const consoleFormLabelSx: SxProps<Theme> = {
  color: '#cbd5e1',
  '& .MuiFormControlLabel-label': {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--ac-text)',
  },
}
