import type { EChartsOption } from 'echarts'
import { chartChrome } from './chartTokens'

const DARK_HEX = [
  '#8b93a8',
  '#e8eaf0',
  '#1f2535',
  '#4d566b',
  '#2a3147',
  '#0f1117',
  '#161b27',
  '#12151f',
  '#121722',
  '#0d1018',
  '#1c2333',
] as const

export function applyChartTheme(
  option: EChartsOption,
  mode: 'dark' | 'light',
): EChartsOption {
  if (mode === 'dark') return option
  const c = chartChrome('light')
  let json = JSON.stringify(option)
  const map: Record<string, string> = {
    '#8b93a8': c.text,
    '#e8eaf0': c.textStrong,
    '#1f2535': c.grid,
    '#4d566b': c.axis,
    '#2a3147': c.tooltipBorder,
    '#0f1117': c.tooltipBg,
    '#161b27': c.tooltipBg,
    '#12151f': c.tooltipBg,
    '#121722': c.grid,
    '#0d1018': c.tooltipBg,
    '#1c2333': c.tooltipBg,
  }
  for (const hex of DARK_HEX) {
    json = json.replaceAll(hex, map[hex])
    json = json.replaceAll(hex.toUpperCase(), map[hex])
  }
  return JSON.parse(json) as EChartsOption
}
