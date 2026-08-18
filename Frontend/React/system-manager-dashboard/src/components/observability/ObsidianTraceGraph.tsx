import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { EmptyState } from '../ui'
import { useUIStore } from '../../store/uiStore'
import { chartChrome } from '../../charts/chartTokens'
import styles from './obs.module.css'

echarts.use([GraphChart, TooltipComponent, CanvasRenderer])

export type TraceGraphNode = {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'down' | string
  reqRate?: number
  errorRate?: number
  p95?: number | null
}

export type TraceGraphEdge = {
  source: string
  target: string
  count?: number
  avgLatencyMs?: number
}

const statusColor = (s: string) => {
  if (s === 'healthy' || s === 'up') return '#10b981'
  if (s === 'degraded' || s === 'warning') return '#f59e0b'
  return '#ef4444'
}

export default function ObsidianTraceGraph({
  nodes,
  edges,
  onNodeClick,
  tall = false,
}: {
  nodes: TraceGraphNode[]
  edges: TraceGraphEdge[]
  onNodeClick?: (node: TraceGraphNode) => void
  tall?: boolean
}) {
  const themeMode = useUIStore((s) => s.themeMode)
  const option = useMemo(() => {
    const chrome = chartChrome(themeMode)
    const maxReq = Math.max(1, ...nodes.map((n) => n.reqRate ?? 0))
    const graphNodes = nodes.map((n) => {
      const color = statusColor(n.status)
      return {
        id: n.id,
        name: n.name,
        symbolSize: Math.max(32, Math.min(64, 32 + ((n.reqRate ?? 0) / maxReq) * 32)),
        category: 0,
        itemStyle: {
          color,
          shadowBlur: 18,
          shadowColor: `${color}99`,
          borderColor: chrome.textStrong,
          borderWidth: 1,
        },
        label: {
          show: true,
          color: chrome.textStrong,
          fontSize: 11,
          fontWeight: 650,
          formatter: `{b}\n${n.p95 ?? '—'}ms`,
        },
        raw: n,
      }
    })

    const links = edges.map((e) => {
      const hot = (e.avgLatencyMs ?? 0) > 300 || (e.count ?? 0) > 50
      return {
        source: e.source,
        target: e.target,
        value: e.count ?? 1,
        lineStyle: {
          color: hot ? 'rgba(239,68,68,0.65)' : 'rgba(6,182,212,0.55)',
          width: Math.max(1.2, Math.min(4, (e.count ?? 1) / 30)),
          curveness: 0.22,
          shadowBlur: 10,
          shadowColor: 'rgba(6,182,212,0.35)',
        },
        label: {
          show: Boolean(e.avgLatencyMs),
          formatter: `${Math.round(e.avgLatencyMs ?? 0)}ms`,
          color: chrome.text,
          fontSize: 9,
        },
        raw: e,
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: chrome.tooltipBg,
        borderColor: chrome.tooltipBorder,
        textStyle: { color: chrome.textStrong, fontSize: 12 },
        formatter: (p: { dataType?: string; data?: { raw?: TraceGraphNode | TraceGraphEdge; name?: string } }) => {
          if (p.dataType === 'node') {
            const n = p.data?.raw as TraceGraphNode
            if (!n) return p.data?.name ?? ''
            return `<b>${n.name}</b><br/>status ${n.status}<br/>${n.reqRate ?? 0}/s · err ${n.errorRate ?? 0}% · p95 ${n.p95 ?? '—'}ms`
          }
          const e = p.data?.raw as TraceGraphEdge
          if (!e) return ''
          return `${e.source} → ${e.target}<br/>${e.count ?? 0} calls · ${Math.round(e.avgLatencyMs ?? 0)}ms`
        },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          data: graphNodes,
          links,
          force: {
            repulsion: 280,
            edgeLength: [80, 160],
            gravity: 0.08,
            friction: 0.2,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 3 },
          },
          lineStyle: { opacity: 0.85 },
        },
      ],
    }
  }, [nodes, edges, themeMode])

  const shellClass = [styles.traceCanvas, tall ? styles.traceCanvasTall : '']
    .filter(Boolean)
    .join(' ')

  if (!nodes.length) {
    return (
      <div className={shellClass}>
        <EmptyState title="No service map yet" hint="Waiting for observability topology." />
      </div>
    )
  }

  return (
    <div className={shellClass} role="img" aria-label="Distributed tracing graph">
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: '100%', width: '100%', minHeight: tall ? 420 : 200 }}
        opts={{ renderer: 'canvas' }}
        onEvents={{
          click: (params: { dataType?: string; data?: { raw?: TraceGraphNode } }) => {
            if (params.dataType === 'node' && params.data?.raw && onNodeClick) {
              onNodeClick(params.data.raw)
            }
          },
        }}
      />
    </div>
  )
}
