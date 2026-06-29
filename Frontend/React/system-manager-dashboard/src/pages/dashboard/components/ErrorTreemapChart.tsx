import { memo, useCallback, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { useNavigate } from 'react-router-dom'
import { chartBase } from '../../../lib/chartTheme'
import { buildLogsUrl } from '../../../store/logsFilterStore'

export interface ErrorItem {
  message: string
  service: string
  count: number
}

interface TreemapMeta {
  service: string
  message?: string
  severity: 'critical' | 'high' | 'warning'
}

function inferSeverity(count: number): TreemapMeta['severity'] {
  if (count > 15) return 'critical'
  if (count > 5) return 'high'
  return 'warning'
}

function ErrorTreemapChart({ errors }: { errors: ErrorItem[] }) {
  const theme = useTheme()
  const navigate = useNavigate()

  const { option, metaByName } = useMemo(() => {
    const byService = new Map<string, ErrorItem[]>()
    for (const err of errors) {
      const list = byService.get(err.service) ?? []
      list.push(err)
      byService.set(err.service, list)
    }

    const meta = new Map<string, TreemapMeta>()
    const treemapData = [...byService.entries()].map(([service, items]) => {
      const total = items.reduce((sum, item) => sum + item.count, 0)
      meta.set(service, { service, severity: inferSeverity(total) })
      return {
        name: service,
        value: total,
        children: items.map((item) => {
          const shortName = item.message.length > 48 ? `${item.message.slice(0, 48)}…` : item.message
          meta.set(shortName, { service, message: item.message, severity: inferSeverity(item.count) })
          return { name: shortName, value: item.count }
        }),
      }
    })

    if (!treemapData.length) {
      return { option: null, metaByName: meta }
    }

    return {
      metaByName: meta,
      option: {
        ...chartBase(theme),
        series: [{
          type: 'treemap',
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: { show: true, height: 20, itemStyle: { color: theme.palette.text.secondary } },
          label: { show: true, formatter: '{b}', fontSize: 10, color: theme.palette.text.primary },
          upperLabel: { show: true, height: 22, color: theme.palette.text.primary, fontSize: 11 },
          itemStyle: { borderColor: theme.palette.background.paper, borderWidth: 1, gapWidth: 1 },
          levels: [
            { itemStyle: { borderColor: theme.palette.divider, borderWidth: 1, gapWidth: 2 } },
            { colorSaturation: [0.35, 0.7], itemStyle: { borderColor: theme.palette.divider, borderWidth: 1, gapWidth: 1 } },
          ],
          data: treemapData,
        }],
      },
    }
  }, [errors, theme])

  const handleClick = useCallback((params: { name?: string }) => {
    if (!params.name) return
    const meta = metaByName.get(params.name)
    if (!meta) return
    const severity = meta.severity
    navigate(buildLogsUrl({
      services: [meta.service],
      levels: severity === 'warning' ? ['ERROR', 'WARN'] : ['ERROR'],
      search: meta.message,
      severity,
    }))
  }, [metaByName, navigate])

  if (!option) return null

  return (
    <ReactECharts
      option={option}
      style={{ height: 260 }}
      notMerge
      onEvents={{ click: handleClick }}
    />
  )
}

export default memo(ErrorTreemapChart)
