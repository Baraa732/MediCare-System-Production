import type { SxProps, Theme } from '@mui/material/styles'

/** Shared field chrome for activation forms — follows html --ac-* theme tokens. */
export const consoleFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: 'var(--ac-panel)',
    color: 'var(--ac-text)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    '& fieldset': {
      borderColor: 'var(--ac-line)',
    },
    '&:hover fieldset': {
      borderColor: 'var(--ac-cyan)',
    },
    '&.Mui-focused': {
      bgcolor: 'var(--ac-panel-2)',
      boxShadow: 'var(--ac-focus-ring)',
      '& fieldset': {
        borderColor: 'var(--ac-cyan)',
        borderWidth: '1px',
      },
    },
    '&.Mui-error fieldset': {
      borderColor: 'var(--ac-danger)',
    },
  },
  '& .MuiInputBase-input': {
    color: 'var(--ac-text)',
    fontSize: 14,
    fontWeight: 500,
    '&::placeholder': {
      color: 'var(--ac-muted)',
      opacity: 1,
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--ac-muted)',
    fontWeight: 600,
    '&.Mui-focused': {
      color: 'var(--ac-glow)',
    },
    '&.Mui-error': {
      color: 'var(--ac-danger)',
    },
  },
  '& .MuiFormHelperText-root': {
    color: 'var(--ac-muted)',
    marginLeft: '2px',
    '&.Mui-error': {
      color: 'var(--ac-danger)',
    },
  },
  '& .MuiSelect-icon': {
    color: 'var(--ac-muted)',
  },
  '& input[type="date"]::-webkit-calendar-picker-indicator': {
    filter: 'var(--ac-date-filter)',
    opacity: 0.7,
    cursor: 'pointer',
  },
}

export const consoleAutocompleteSx: SxProps<Theme> = {
  ...consoleFieldSx,
  '& .MuiChip-root': {
    bgcolor: 'var(--ac-fill)',
    color: 'var(--ac-soft)',
    border: '1px solid var(--ac-line)',
    borderRadius: '8px',
    height: 26,
    fontWeight: 650,
    '& .MuiChip-deleteIcon': {
      color: 'var(--ac-glow)',
      opacity: 0.8,
      '&:hover': { color: 'var(--ac-text)', opacity: 1 },
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
        border: '1px solid var(--ac-line)',
        backgroundImage: 'none',
        boxShadow: 'var(--ac-shadow)',
        '& .MuiMenuItem-root': {
          fontSize: 13.5,
          fontWeight: 550,
          borderRadius: '8px',
          mx: 0.5,
          color: 'var(--ac-text)',
          '&:hover': { bgcolor: 'var(--ac-fill)' },
          '&.Mui-selected': {
            bgcolor: 'var(--ac-fill-strong)',
            '&:hover': { bgcolor: 'var(--ac-fill-strong)' },
          },
        },
      },
    },
  },
}

export const consoleCheckboxSx: SxProps<Theme> = {
  color: 'var(--ac-muted)',
  '&.Mui-checked': { color: 'var(--ac-cyan)' },
}

export const consoleFormLabelSx: SxProps<Theme> = {
  color: 'var(--ac-text)',
  '& .MuiFormControlLabel-label': {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--ac-text)',
  },
}

export const consoleAlertSx: SxProps<Theme> = {
  borderRadius: '12px',
  bgcolor: 'var(--ac-warn-fill)',
  color: 'var(--ac-warn)',
  border: '1px solid var(--ac-warn-border)',
  '& .MuiAlert-icon': { color: 'var(--ac-warn-icon)' },
}

export const consoleReviewCardSx: SxProps<Theme> = {
  p: 1.75,
  borderRadius: '14px',
  border: '1px solid var(--ac-line)',
  bgcolor: 'var(--ac-card-bg)',
  transition: 'border-color 0.2s ease, background 0.2s ease',
  '&:hover': {
    borderColor: 'var(--ac-cyan)',
    bgcolor: 'var(--ac-card-hover)',
  },
}
