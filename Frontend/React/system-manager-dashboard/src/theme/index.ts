import { createTheme, alpha, type Theme } from '@mui/material/styles'

declare module '@mui/material/styles' {
  interface TypeBackground {
    surface: string
    elevated: string
    hover: string
    selected: string
  }
  interface Palette {
    accent: {
      default: string
      hover: string
      subtle: string
      border: string
    }
    chart: {
      colors: string[]
      grid: string
      axis: string
    }
    status: {
      success: string
      warning: string
      error: string
      info: string
      muted: string
    }
  }
  interface PaletteOptions {
    accent?: {
      default?: string
      hover?: string
      subtle?: string
      border?: string
    }
    chart?: {
      colors?: string[]
      grid?: string
      axis?: string
    }
    status?: {
      success?: string
      warning?: string
      error?: string
      info?: string
      muted?: string
    }
  }
  interface TypographyVariants {
    mono: React.CSSProperties
    metric: React.CSSProperties
    metricSm: React.CSSProperties
    caption2: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    mono?: React.CSSProperties
    metric?: React.CSSProperties
    metricSm?: React.CSSProperties
    caption2?: React.CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true
    metric: true
    metricSm: true
    caption2: true
  }
}

const FONTS = {
  ui: '"Inter", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
}

const DARK = {
  bg: {
    page: '#0f1117',
    surface: '#161b27',
    elevated: '#1c2333',
    hover: '#1e2438',
    selected: '#1a2540',
  },
  border: {
    subtle: '#1f2535',
    default: '#2a3147',
    strong: '#3d4663',
  },
  text: {
    primary: '#e8eaf0',
    secondary: '#8b93a8',
    tertiary: '#4d566b',
  },
  accent: {
    default: '#06b6d4',
    hover: '#0891b2',
    subtle: alpha('#06b6d4', 0.08),
    border: alpha('#06b6d4', 0.25),
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
    muted: '#4d566b',
  },
  chart: {
    colors: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#ec4899'],
    grid: '#1f2535',
    axis: '#4d566b',
  },
}

const LIGHT = {
  bg: {
    page: '#f3f5f8',
    surface: '#ffffff',
    elevated: '#f8fafc',
    hover: '#eef2f6',
    selected: '#e6f7fb',
  },
  border: {
    subtle: '#e2e8f0',
    default: '#cbd5e1',
    strong: '#94a3b8',
  },
  text: {
    primary: '#0f172a',
    secondary: '#64748b',
    tertiary: '#94a3b8',
  },
  accent: {
    default: '#0891b2',
    hover: '#0e7490',
    subtle: alpha('#0891b2', 0.08),
    border: alpha('#0891b2', 0.25),
  },
  status: {
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0891b2',
    muted: '#94a3b8',
  },
  chart: {
    colors: ['#0891b2', '#7c3aed', '#d97706', '#059669', '#ea580c', '#db2777'],
    grid: '#e2e8f0',
    axis: '#94a3b8',
  },
}

function buildTypography(secondary: string) {
  return {
    fontFamily: FONTS.ui,
    fontSize: 13,
    h1: { fontSize: '24px', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.02em' },
    h2: { fontSize: '20px', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
    h3: { fontSize: '16px', fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: '14px', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '13px', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '12px', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '14px', fontWeight: 400, lineHeight: 1.6 },
    body2: { fontSize: '13px', fontWeight: 400, lineHeight: 1.5 },
    caption: {
      fontSize: '11px',
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      color: secondary,
    },
    overline: {
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    },
    mono: {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.6,
    },
    metric: {
      fontFamily: FONTS.ui,
      fontSize: '28px',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    metricSm: {
      fontFamily: FONTS.ui,
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    caption2: {
      fontFamily: FONTS.ui,
      fontSize: '11px',
      fontWeight: 400,
      lineHeight: 1.4,
      color: secondary,
    },
  }
}

const NONE_SHADOWS = [
  'none',
  'none', 'none', 'none', 'none',
  'none', 'none', 'none', 'none',
  'none', 'none', 'none', 'none',
  'none', 'none', 'none', 'none',
  'none', 'none', 'none', 'none',
  'none', 'none', 'none', 'none',
] as unknown as Theme['shadows']

const LIGHT_SHADOWS = [
  'none',
  '0 1px 2px rgba(15,23,42,0.06)',
  '0 1px 3px rgba(15,23,42,0.08)',
  '0 4px 12px rgba(15,23,42,0.08)',
  '0 8px 24px rgba(15,23,42,0.1)',
  '0 12px 32px rgba(15,23,42,0.12)',
  ...Array(19).fill('0 12px 32px rgba(15,23,42,0.12)'),
] as unknown as Theme['shadows']

const sharedComponents = {
  MuiCssBaseline: {
    styleOverrides: (theme: Theme) => ({
      '*': { boxSizing: 'border-box' as const },
      body: {
        background: theme.palette.background.default,
        scrollbarWidth: 'thin' as const,
        scrollbarColor: `${theme.palette.divider} transparent`,
      },
      '::-webkit-scrollbar': { width: '6px', height: '6px' },
      '::-webkit-scrollbar-track': { background: 'transparent' },
      '::-webkit-scrollbar-thumb': {
        background: theme.palette.mode === 'dark' ? '#2a3147' : '#cbd5e1',
        borderRadius: '3px',
        '&:hover': {
          background: theme.palette.mode === 'dark' ? '#3d4663' : '#94a3b8',
        },
      },
    }),
  },

  MuiButton: {
    defaultProps: {
      disableElevation: true,
      size: 'small' as const,
    },
    styleOverrides: {
      root: {
        textTransform: 'none' as const,
        fontWeight: 500,
        fontSize: '13px',
        borderRadius: '4px',
        padding: '5px 12px',
        minHeight: '30px',
      },
      contained: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        '&:hover': { background: theme.palette.primary.dark },
      }),
      outlined: ({ theme }: { theme: Theme }) => ({
        borderColor: theme.palette.mode === 'dark' ? '#2a3147' : '#cbd5e1',
        color: theme.palette.text.primary,
        '&:hover': {
          background: theme.palette.background.hover,
          borderColor: theme.palette.mode === 'dark' ? '#3d4663' : '#94a3b8',
        },
      }),
      text: ({ theme }: { theme: Theme }) => ({
        color: theme.palette.text.secondary,
        '&:hover': {
          background: theme.palette.background.hover,
          color: theme.palette.text.primary,
        },
      }),
    },
  },

  MuiIconButton: {
    defaultProps: { size: 'small' as const },
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        borderRadius: '4px',
        color: theme.palette.text.secondary,
        '&:hover': {
          background: theme.palette.background.hover,
          color: theme.palette.text.primary,
        },
      }),
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        fontSize: '13px',
        borderRadius: '4px',
        background: theme.palette.background.paper,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.mode === 'dark' ? '#2a3147' : '#cbd5e1',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.mode === 'dark' ? '#3d4663' : '#94a3b8',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.main,
          borderWidth: '1px',
          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }),
      input: ({ theme }: { theme: Theme }) => ({
        padding: '6px 10px',
        height: '20px',
        color: theme.palette.text.primary,
        '&::placeholder': { color: theme.palette.text.disabled, opacity: 1 },
      }),
    },
  },

  MuiInputLabel: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        fontSize: '13px',
        color: theme.palette.text.secondary,
        '&.Mui-focused': { color: theme.palette.primary.main },
      }),
    },
  },

  MuiSelect: {
    defaultProps: { size: 'small' as const },
    styleOverrides: {
      icon: ({ theme }: { theme: Theme }) => ({ color: theme.palette.text.secondary }),
    },
  },

  MuiPaper: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        backgroundImage: 'none',
        backgroundColor: theme.palette.background.paper,
      }),
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.elevated,
        border: `1px solid ${theme.palette.mode === 'dark' ? '#2a3147' : '#e2e8f0'}`,
        borderRadius: '4px',
        boxShadow: theme.palette.mode === 'light' ? '0 12px 32px rgba(15,23,42,0.12)' : 'none',
      }),
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        fontSize: '13px',
        minHeight: '32px',
        padding: '6px 12px',
        color: theme.palette.text.primary,
        '&:hover': { background: theme.palette.background.hover },
        '&.Mui-selected': {
          background: theme.palette.background.selected,
          '&:hover': { background: theme.palette.background.hover },
        },
      }),
    },
  },

  MuiPopover: {
    styleOverrides: {
      paper: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === 'light' ? '0 12px 32px rgba(15,23,42,0.12)' : 'none',
      }),
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === 'light' ? '0 24px 48px rgba(15,23,42,0.16)' : 'none',
      }),
    },
  },

  MuiTable: {
    styleOverrides: {
      root: { borderCollapse: 'collapse' as const },
    },
  },

  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        '& .MuiTableCell-root': {
          background: theme.palette.mode === 'dark' ? theme.palette.background.paper : theme.palette.background.elevated,
          borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#2a3147' : '#e2e8f0'}`,
          color: theme.palette.text.secondary,
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          padding: '8px 12px',
        whiteSpace: 'nowrap' as const,
        },
      }),
    },
  },

  MuiTableBody: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        '& .MuiTableRow-root': {
          '&:hover': { background: theme.palette.background.hover },
          '&.Mui-selected': { background: theme.palette.background.selected },
        },
      }),
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        fontSize: '13px',
        padding: '7px 12px',
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        height: '36px',
      }),
      body: ({ theme }: { theme: Theme }) => ({
        color: theme.palette.text.primary,
      }),
    },
  },

  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '4px',
        boxShadow: theme.palette.mode === 'light' ? '0 1px 2px rgba(15,23,42,0.05)' : 'none',
      }),
    },
  },

  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: '16px',
        '&:last-child': { paddingBottom: '16px' },
      },
    },
  },

  MuiCardHeader: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
      title: ({ theme }: { theme: Theme }) => ({
        fontSize: '13px',
        fontWeight: 600,
        color: theme.palette.text.primary,
      }),
      subheader: ({ theme }: { theme: Theme }) => ({
        fontSize: '12px',
        color: theme.palette.text.secondary,
      }),
    },
  },

  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 500,
        height: '20px',
      },
      filled: ({ theme }: { theme: Theme }) => ({
        '&.MuiChip-colorSuccess': {
          background: alpha(theme.palette.success.main, 0.12),
          color: theme.palette.success.main,
        },
        '&.MuiChip-colorWarning': {
          background: alpha(theme.palette.warning.main, 0.12),
          color: theme.palette.warning.main,
        },
        '&.MuiChip-colorError': {
          background: alpha(theme.palette.error.main, 0.12),
          color: theme.palette.error.main,
        },
        '&.MuiChip-colorInfo': {
          background: alpha(theme.palette.info.main, 0.12),
          color: theme.palette.info.main,
        },
        '&.MuiChip-colorDefault': {
          background: theme.palette.background.hover,
          color: theme.palette.text.secondary,
        },
      }),
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        minHeight: '36px',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
      indicator: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.primary.main,
        height: '2px',
      }),
    },
  },

  MuiTab: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        minHeight: '36px',
        fontSize: '13px',
        fontWeight: 400,
        textTransform: 'none' as const,
        color: theme.palette.text.secondary,
        padding: '0 16px',
        '&.Mui-selected': {
          color: theme.palette.text.primary,
          fontWeight: 500,
        },
        '&:hover': {
          color: theme.palette.text.primary,
          background: theme.palette.background.hover,
        },
      }),
    },
  },

  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.mode === 'dark' ? '#1c2333' : '#0f172a',
        border: `1px solid ${theme.palette.mode === 'dark' ? '#2a3147' : '#1e293b'}`,
        color: '#f8fafc',
        fontSize: '12px',
        borderRadius: '4px',
        padding: '6px 10px',
        boxShadow: theme.palette.mode === 'light' ? '0 8px 24px rgba(15,23,42,0.18)' : 'none',
      }),
      arrow: ({ theme }: { theme: Theme }) => ({
        color: theme.palette.mode === 'dark' ? '#1c2333' : '#0f172a',
      }),
    },
  },

  MuiDivider: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        borderColor: theme.palette.divider,
      }),
    },
  },

  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.paper,
        border: 'none',
        borderRight: `1px solid ${theme.palette.divider}`,
      }),
    },
  },

  MuiAppBar: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
      }),
    },
  },

  MuiBreadcrumbs: {
    styleOverrides: {
      root: { fontSize: '13px' },
      separator: ({ theme }: { theme: Theme }) => ({ color: theme.palette.text.disabled }),
      ol: { flexWrap: 'nowrap' as const },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        height: '3px',
        borderRadius: '2px',
        background: theme.palette.mode === 'dark' ? '#2a3147' : '#e2e8f0',
      }),
      bar: {
        borderRadius: '2px',
      },
    },
  },

  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.elevated,
        '&::after': {
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(15,23,42,0.06), transparent)',
        },
      }),
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.background.paper,
      }),
    },
  },

  MuiSwitch: {
    styleOverrides: {
      track: ({ theme }: { theme: Theme }) => ({
        backgroundColor: theme.palette.mode === 'dark' ? '#2a3147' : '#cbd5e1',
      }),
    },
  },

  MuiPaginationItem: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        color: theme.palette.text.secondary,
        '&.Mui-selected': {
          background: theme.palette.background.selected,
          color: theme.palette.text.primary,
        },
      }),
    },
  },

  MuiAccordion: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        background: theme.palette.background.paper,
        color: theme.palette.text.primary,
        boxShadow: 'none',
        border: `1px solid ${theme.palette.divider}`,
        '&:before': { display: 'none' },
      }),
    },
  },

  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        color: theme.palette.text.primary,
        '&:hover': { background: theme.palette.background.hover },
        '&.Mui-selected': { background: theme.palette.background.selected },
      }),
    },
  },

  MuiBackdrop: {
    styleOverrides: {
      root: ({ theme }: { theme: Theme }) => ({
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(5,7,12,0.55)' : 'rgba(15,23,42,0.32)',
      }),
    },
  },
}

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: DARK.bg.page,
      paper: DARK.bg.surface,
      surface: DARK.bg.surface,
      elevated: DARK.bg.elevated,
      hover: DARK.bg.hover,
      selected: DARK.bg.selected,
    },
    primary: {
      main: DARK.accent.default,
      dark: DARK.accent.hover,
      light: '#22d3ee',
      contrastText: '#0f1117',
    },
    secondary: {
      main: '#8b5cf6',
      contrastText: '#ffffff',
    },
    success: {
      main: DARK.status.success,
      contrastText: '#0f1117',
    },
    warning: {
      main: DARK.status.warning,
      contrastText: '#0f1117',
    },
    error: {
      main: DARK.status.error,
      contrastText: '#ffffff',
    },
    info: {
      main: DARK.status.info,
      contrastText: '#0f1117',
    },
    text: {
      primary: DARK.text.primary,
      secondary: DARK.text.secondary,
      disabled: DARK.text.tertiary,
    },
    divider: DARK.border.subtle,
    accent: DARK.accent,
    chart: DARK.chart,
    status: DARK.status,
  },
  typography: buildTypography(DARK.text.secondary),
  shape: { borderRadius: 4 },
  spacing: 4,
  shadows: NONE_SHADOWS,
  components: sharedComponents,
})

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: LIGHT.bg.page,
      paper: LIGHT.bg.surface,
      surface: LIGHT.bg.surface,
      elevated: LIGHT.bg.elevated,
      hover: LIGHT.bg.hover,
      selected: LIGHT.bg.selected,
    },
    primary: {
      main: LIGHT.accent.default,
      dark: LIGHT.accent.hover,
      light: '#06b6d4',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
      contrastText: '#ffffff',
    },
    success: { main: LIGHT.status.success, contrastText: '#ffffff' },
    warning: { main: LIGHT.status.warning, contrastText: '#ffffff' },
    error: { main: LIGHT.status.error, contrastText: '#ffffff' },
    info: { main: LIGHT.status.info, contrastText: '#ffffff' },
    text: {
      primary: LIGHT.text.primary,
      secondary: LIGHT.text.secondary,
      disabled: LIGHT.text.tertiary,
    },
    divider: LIGHT.border.subtle,
    accent: LIGHT.accent,
    chart: LIGHT.chart,
    status: LIGHT.status,
  },
  typography: buildTypography(LIGHT.text.secondary),
  shape: { borderRadius: 4 },
  spacing: 4,
  shadows: LIGHT_SHADOWS,
  components: sharedComponents,
})

export const getDensityTokens = (density: 'compact' | 'default' | 'comfortable') => ({
  tableRowHeight: density === 'compact' ? 28 : density === 'comfortable' ? 44 : 36,
  cardPadding: density === 'compact' ? 12 : density === 'comfortable' ? 24 : 16,
  inputHeight: density === 'compact' ? 28 : density === 'comfortable' ? 40 : 32,
})
