export const COLORS = {
  bg: {
    page:     '#0f1117',
    surface:  '#161b27',
    elevated: '#1c2333',
    hover:    '#1e2438',
    selected: '#1a2540',
    overlay:  'rgba(0,0,0,0.6)',
  },
  border: {
    subtle:  '#1f2535',
    default: '#2a3147',
    strong:  '#3d4663',
  },
  text: {
    primary:   '#e8eaf0',
    secondary: '#8b93a8',
    tertiary:  '#4d566b',
    inverse:   '#0f1117',
  },
  accent: {
    default: '#06b6d4',
    hover:   '#0891b2',
    subtle:  '#06b6d415',
    border:  '#06b6d440',
  },
  secondary: {
    default: '#8b5cf6',
    subtle:  '#8b5cf615',
    border:  '#8b5cf640',
  },
  status: {
    success:    '#10b981',
    successBg:  '#10b98115',
    warning:    '#f59e0b',
    warningBg:  '#f59e0b15',
    error:      '#ef4444',
    errorBg:    '#ef444415',
    info:       '#06b6d4',
    infoBg:     '#06b6d415',
    muted:      '#4d566b',
  },
  chart: {
    colors: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#ec4899'],
    grid:   '#1f2535',
    axis:   '#4d566b',
  },
} as const

export const SPACING = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const

export const RADIUS = {
  sm: 3,
  md: 4,
  lg: 6,
  xl: 12,
  xxl: 16,
} as const

/** Control Center visual extensions — keep MediCare palette, improve polish. */
export const CC = {
  glow: {
    accent: '0 0 24px rgba(6, 182, 212, 0.22)',
    accentSoft: '0 0 12px rgba(6, 182, 212, 0.12)',
    success: '0 0 16px rgba(16, 185, 129, 0.25)',
    error: '0 0 16px rgba(239, 68, 68, 0.25)',
    warning: '0 0 16px rgba(245, 158, 11, 0.22)',
  },
  glass: {
    bg: 'rgba(22, 27, 39, 0.72)',
    bgStrong: 'rgba(28, 35, 51, 0.88)',
    border: 'rgba(42, 49, 71, 0.9)',
    blur: '12px',
  },
  layout: {
    topbarH: 56,
    sidebarExpanded: 240,
    sidebarCollapsed: 64,
  },
} as const
