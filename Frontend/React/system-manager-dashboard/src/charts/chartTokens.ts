export type ChartChrome = {
  text: string
  textStrong: string
  grid: string
  axis: string
  tooltipBg: string
  tooltipBorder: string
}

const DARK_CHROME: ChartChrome = {
  text: '#8b93a8',
  textStrong: '#e8eaf0',
  grid: '#1f2535',
  axis: '#4d566b',
  tooltipBg: '#0f1117',
  tooltipBorder: '#2a3147',
}

const LIGHT_CHROME: ChartChrome = {
  text: '#64748b',
  textStrong: '#0f172a',
  grid: '#e2e8f0',
  axis: '#94a3b8',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
}

export function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'light'
}

export function chartChrome(mode?: 'dark' | 'light'): ChartChrome {
  const light = mode ? mode === 'light' : isLightTheme()
  return light ? LIGHT_CHROME : DARK_CHROME
}

export const CC_CHART = {
  bg: 'transparent' as const,
  get text() {
    return chartChrome().text
  },
  get textStrong() {
    return chartChrome().textStrong
  },
  get grid() {
    return chartChrome().grid
  },
  get axis() {
    return chartChrome().axis
  },
  get tooltipBg() {
    return chartChrome().tooltipBg
  },
  get tooltipBorder() {
    return chartChrome().tooltipBorder
  },
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  orange: '#f97316',
}

export function baseTooltip() {
  const c = chartChrome()
  const light = isLightTheme()
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    textStyle: { color: c.textStrong, fontSize: 12 },
    extraCssText: light
      ? 'border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.12);'
      : 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);',
  }
}
