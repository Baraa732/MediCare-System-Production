import { memo, useCallback, useMemo } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ServiceMapEdgeMetrics, ServiceMapNode } from '../serviceMapUtils'
import { NODE_POSITIONS, mapStatusLabel, statusColor } from '../serviceMapUtils'

echarts.use([GraphChart, TooltipComponent, CanvasRenderer])

interface ServiceMapGraphProps {
  nodes: ServiceMapNode[]
  edges: ServiceMapEdgeMetrics[]
  onNodeClick: (node: ServiceMapNode) => void
  onEdgeClick: (edge: ServiceMapEdgeMetrics) => void
}

function ServiceMapGraph({ nodes, edges, onNodeClick, onEdgeClick }: ServiceMapGraphProps) {
  const theme = useTheme()
  const nodeByName = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes])

  const option = useMemo(() => {
    const maxReq = Math.max(1, ...nodes.map((n) => n.reqRate))
    const graphNodes = nodes.map((svc, index) => {
      const pos = NODE_POSITIONS[svc.name] ?? { x: 120 + (index % 4) * 160, y: 100 + Math.floor(index / 4) * 120 }
      const color = statusColor(svc.status)
      const status = mapStatusLabel(svc.status)
      return {
        id: svc.name,
        name: svc.name,
        x: pos.x,
        y: pos.y,
        symbolSize: Math.max(28, Math.min(56, 28 + (svc.reqRate / maxReq) * 28)),
        itemStyle: { color, borderWidth: 2, borderColor: theme.palette.background.paper },
        label: {
          show: true,
          position: 'bottom',
          formatter: (p: { data?: { name?: string; p95?: number; err?: number; rps?: number } }) => {
            const d = p.data
            if (!d?.name) return ''
            return `${d.name}\n${d.p95 ?? 0}ms · ${d.err ?? 0}% · ${d.rps ?? 0}/s`
          },
          color: theme.palette.text.secondary,
          fontSize: 10,
          lineHeight: 14,
        },
        p95: svc.p95 ?? 0,
        err: svc.errorRate,
        rps: svc.reqRate,
        status,
        svc,
      }
    })

    const links = edges.map((edge) => {
      const width = Math.max(1, Math.min(4, edge.trafficVolume / 40))
      const color = edge.errorCount > 5 ? '#ef4444' : edge.avgLatencyMs > 300 ? '#f59e0b' : theme.palette.divider
      return {
        source: edge.source,
        target: edge.target,
        lineStyle: { color, width, curveness: 0.15 },
        label: {
          show: edge.trafficVolume > 20,
          formatter: `${edge.trafficVolume}/s`,
          fontSize: 9,
          color: theme.palette.text.disabled,
        },
        edge,
      }
    })

    return {
      tooltip: {
        backgroundColor: theme.palette.background.elevated,
        borderColor: theme.palette.divider,
        textStyle: { color: theme.palette.text.primary, fontSize: 12 },
        formatter: (p: { dataType?: string; data?: { name?: string; svc?: ServiceMapNode; edge?: ServiceMapEdgeMetrics } }) => {
          if (p.dataType === 'edge' && p.data?.edge) {
            const e = p.data.edge
            return [
              `<b>${e.source} → ${e.target}</b>`,
              `Traffic: ${e.trafficVolume}/s`,
              `Errors: ${e.errorCount}`,
              `Avg latency: ${e.avgLatencyMs}ms`,
            ].join('<br/>')
          }
          const svc = p.data?.svc
          if (!svc) return p.data?.name ?? ''
          return [
            `<b>${svc.name}</b>`,
            `Status: ${mapStatusLabel(svc.status)}`,
            `p95: ${svc.p95 ?? 0}ms`,
            `Error rate: ${svc.errorRate}%`,
            `Throughput: ${svc.reqRate}/s`,
            `Team: ${svc.ownerTeam}`,
          ].join('<br/>')
        },
      },
      series: [{
        type: 'graph',
        layout: 'none',
        roam: true,
        draggable: false,
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
        data: graphNodes,
        links,
      }],
    }
  }, [edges, nodes, theme])

  const handleClick = useCallback((params: { dataType?: string; name?: string; data?: { edge?: ServiceMapEdgeMetrics } }) => {
    if (params.dataType === 'edge' && params.data?.edge) {
      onEdgeClick(params.data.edge)
      return
    }
    const svc = nodeByName.get(params.name ?? '')
    if (svc) onNodeClick(svc)
  }, [nodeByName, onEdgeClick, onNodeClick])

  return (
    <Box sx={{ height: 520, border: 1, borderColor: 'divider', borderRadius: '5px', overflow: 'hidden', bgcolor: 'background.paper' }}>
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 520 }} onEvents={{ click: handleClick }} notMerge />
    </Box>
  )
}

export default memo(ServiceMapGraph)
