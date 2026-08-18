import type { Theme } from '@mui/material/styles'

export const CHART_PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#ec4899', '#ef4444']

export const CHART_LINE_WIDTH = 1

export function chartTooltip(theme: Theme) {
  return {
    backgroundColor: theme.palette.mode === 'dark' ? '#0f1117' : '#ffffff',
    borderColor: theme.palette.divider,
    textStyle: { color: theme.palette.text.primary, fontSize: 12 },
  }
}

export function chartBase(theme: Theme) {
  return {
    textStyle: { color: theme.palette.text.secondary, fontSize: 11 },
    tooltip: chartTooltip(theme),
  }
}

export function chartGrid(compact = false) {
  return compact
    ? { top: 8, right: 8, bottom: 20, left: 36, containLabel: true }
    : { top: 28, right: 12, bottom: 28, left: 44, containLabel: true }
}

export function thinLineSeries(name: string, data: number[], color: string) {
  return {
    name,
    type: 'line' as const,
    data,
    smooth: false,
    symbol: 'none',
    lineStyle: { color, width: CHART_LINE_WIDTH },
  }
}

export function flatBarSeries(name: string, data: number[], color: string, stack?: string) {
  return {
    name,
    type: 'bar' as const,
    stack,
    data,
    barMaxWidth: 10,
    itemStyle: { color, borderRadius: stack ? 0 : [2, 2, 0, 0] },
  }
}

export function buildLogFlowSankey(
  theme: Theme,
  services: Array<{ name: string; count: number }>,
  levels: Array<{ level: string; count: number }>,
  entries: Array<{ service: string; level: string }>,
) {
  const topServices = [...services].sort((a, b) => b.count - a.count).slice(0, 6)
  const serviceNames = new Set(topServices.map((s) => s.name))
  const levelNames = levels.filter((l) => l.count > 0).map((l) => l.level)

  const linkMap = new Map<string, number>()
  for (const entry of entries) {
    if (!serviceNames.has(entry.service)) continue
    const key = `${entry.service}→${entry.level}`
    linkMap.set(key, (linkMap.get(key) ?? 0) + 1)
  }

  const nodes = [
    ...topServices.map((s) => ({ name: s.name })),
    ...levelNames.map((l) => ({ name: l })),
  ]

  const links = Array.from(linkMap.entries()).map(([key, value]) => {
    const [source, target] = key.split('→')
    return { source, target, value }
  })

  return {
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      nodeWidth: 12,
      nodeGap: 10,
      lineStyle: { color: theme.palette.divider, curveness: 0.45, opacity: 0.55 },
      label: { color: theme.palette.text.secondary, fontSize: 10 },
      data: nodes.length ? nodes : [{ name: 'No data' }],
      links: links.length ? links : [],
    }],
  }
}
