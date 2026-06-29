import { memo, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { PlatformStats } from '../../../api/types'
import { chartBase, chartGrid } from '../../../lib/chartTheme'

function ActivationFunnelChart({ stats }: { stats: PlatformStats | null }) {
  const theme = useTheme()
  const option = useMemo(() => {
    const codesTotal = stats?.activationCodes.total ?? 0
    const codesUsed = stats?.activationCodes.byStatus.USED ?? stats?.activationCodes.byStatus.used ?? 0
    const usersTotal = stats?.users.total ?? 0
    const activeClinics = stats?.clinics.byStatus.ACTIVE ?? 0
    const stages = ['Activation Codes', 'Codes Used', 'User Signups', 'Active Clinics']
    const values = [codesTotal, codesUsed, usersTotal, activeClinics]

    return {
      ...chartBase(theme),
      grid: chartGrid(true),
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      xAxis: {
        type: 'category',
        data: stages,
        axisLabel: { color: theme.palette.text.disabled, fontSize: 10, interval: 0, rotate: 12 },
        axisLine: { lineStyle: { color: theme.palette.divider } },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.palette.divider } },
        axisLabel: { color: theme.palette.text.disabled, fontSize: 10 },
      },
      series: [{
        type: 'bar',
        data: values.map((value, index) => ({
          value,
          itemStyle: {
            color: ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'][index],
            borderRadius: [2, 2, 0, 0],
          },
        })),
        barMaxWidth: 36,
      }],
    }
  }, [stats, theme])

  return <ReactECharts option={option} style={{ height: 220 }} notMerge />
}

export default memo(ActivationFunnelChart)
