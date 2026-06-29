import { useMemo, useState, useCallback } from 'react'
import { Box, Typography, Paper, IconButton } from '@mui/material'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { X } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import type { ApmService, PlatformObservability } from '../../../api/types'

echarts.use([GraphChart, TooltipComponent, CanvasRenderer])

const statusColor: Record<string, string> = { healthy: '#10b981', degraded: '#f59e0b', down: '#ef4444' }

interface ApmServiceMapProps {
  services: ApmService[]
  serviceMap?: PlatformObservability['apm']['serviceMap']
}

const preferredPositions: Record<string, { x: number; y: number; symbolSize: number }> = {
  'api-gateway': { x: 300, y: 100, symbolSize: 40 },
  'auth-service': { x: 150, y: 210, symbolSize: 28 },
  'user-service': { x: 450, y: 210, symbolSize: 28 },
  'clinic-service': { x: 150, y: 330, symbolSize: 28 },
  'system-manager-service': { x: 450, y: 330, symbolSize: 28 },
  'appointment-service': { x: 300, y: 260, symbolSize: 22 },
  'scheduling-service': { x: 550, y: 100, symbolSize: 26 },
  'notification-service': { x: 600, y: 260, symbolSize: 18 },
  'emr-service': { x: 300, y: 420, symbolSize: 30 },
  'reminder-service': { x: 520, y: 420, symbolSize: 20 },
}

export default function ApmServiceMap({ services, serviceMap }: ApmServiceMapProps) {
  const theme = useTheme()
  const [popover, setPopover] = useState<{ svc: ApmService; x: number; y: number } | null>(null)

  const maxReqRate = Math.max(1, ...services.map((s) => s.reqRate))
  const seriesNodes = services.map((svc, index) => {
    const fallback = {
      x: 110 + (index % 4) * 150,
      y: 120 + Math.floor(index / 4) * 110,
      symbolSize: 24,
    }
    const position = preferredPositions[svc.name] ?? fallback
    return {
      id: svc.name,
      name: svc.name,
      ...position,
      itemStyle: { color: statusColor[svc.status] },
      symbolSize: Math.max(14, position.symbolSize * (svc.reqRate / maxReqRate || 0.35)),
      label: { show: true, position: 'bottom', color: '#8b93a8', fontSize: 11 },
    }
  })

  const edges = (serviceMap?.edges ?? []).map(([source, target]) => ({ source, target }))

  const handleClick = useCallback((event: { name: string }) => {
    const svc = services.find((s) => s.name === event.name)
    if (svc) {
      setPopover({ svc, x: 300, y: 200 })
    }
  }, [services])

  const option = useMemo(() => ({
    tooltip: {
      backgroundColor: theme.palette.background.elevated,
      borderColor: theme.palette.divider,
      textStyle: { color: theme.palette.text.primary, fontSize: 12 },
      formatter: (p: { data?: { name?: string } }) => p.data?.name || '',
    },
    series: [{
      type: 'graph',
      layout: 'none',
      roam: true,
      draggable: false,
      data: seriesNodes,
      links: edges.map((e) => ({ source: e.source, target: e.target, lineStyle: { color: theme.palette.divider, width: 1 } })),
    }],
  }), [theme, seriesNodes, edges])

  return (
    <Box sx={{ position: 'relative', height: 360 }}>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 360 }}
        onEvents={{ click: handleClick }}
        notMerge
      />

      {popover && (
        <Paper
          sx={{
            position: 'fixed',
            top: popover.y + 20,
            left: popover.x,
            transform: 'translateX(-50%)',
            zIndex: 1300,
            width: 220,
            p: 1.5,
            bgcolor: 'background.elevated',
            border: 1,
            borderColor: 'divider',
            borderRadius: '4px',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h4">{popover.svc.name}</Typography>
            <IconButton size="small" onClick={() => setPopover(null)} sx={{ color: 'text.secondary', p: 0 }}>
              <X size={14} />
            </IconButton>
          </Box>
          <Box sx={{ '& > *': { py: 0.25 } }}>
            <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
              Req/s: <span style={{ color: theme.palette.text.primary }}>{popover.svc.reqRate.toLocaleString()}</span>
            </Typography>
            <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
              Error%: <span style={{ color: popover.svc.errorRate > 5 ? '#ef4444' : theme.palette.text.primary }}>{popover.svc.errorRate}%</span>
            </Typography>
            <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
              P99: <span style={{ color: popover.svc.p99 && popover.svc.p99 > 500 ? '#ef4444' : theme.palette.text.primary }}>
                {popover.svc.p99 !== null ? `${popover.svc.p99}ms` : '—'}
              </span>
            </Typography>
            <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
              Instances: <span style={{ color: theme.palette.text.primary }}>{popover.svc.instances}</span>
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  )
}
