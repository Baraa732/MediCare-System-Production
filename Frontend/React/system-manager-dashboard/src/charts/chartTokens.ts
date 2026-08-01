export const CC_CHART = {
  bg: 'transparent',
  text: '#8b93a8',
  textStrong: '#e8eaf0',
  grid: '#1f2535',
  axis: '#4d566b',
  tooltipBg: '#0f1117',
  tooltipBorder: '#2a3147',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  orange: '#f97316',
} as const

export function baseTooltip() {
  return {
    backgroundColor: CC_CHART.tooltipBg,
    borderColor: CC_CHART.tooltipBorder,
    textStyle: { color: CC_CHART.textStrong, fontSize: 12 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);',
  }
}
