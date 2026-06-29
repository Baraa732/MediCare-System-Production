import { memo } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Button, Typography } from '@mui/material'
import { Download, FileText } from 'lucide-react'
import type { ExecutiveSummary } from '../../../lib/executiveSummaryEngine'
import { downloadDailyReport, toDailyReportJson } from '../../../lib/executiveSummaryEngine'
import type { ApmService } from '../../../api/types'
import type { DashboardIncident } from '../dashboardUtils'
import { Panel } from './DashboardPanels'

interface ExecutiveSummaryCardProps {
  summary: ExecutiveSummary
  services: ApmService[]
  incidents: DashboardIncident[]
}

function ExecutiveSummaryCard({ summary, services, incidents }: ExecutiveSummaryCardProps) {
  return (
    <Panel title="Executive Summary" caption={`${summary.periodLabel} · AI-generated operational brief`}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {summary.periodLabel} Summary
        </Typography>
        {summary.highlights.map((line) => (
          <Typography key={line} variant="caption2" sx={{ color: 'text.secondary', display: 'block' }}>
            • {line}
          </Typography>
        ))}
        <Box sx={{ p: 1.1, borderRadius: '4px', border: 1, borderColor: alpha('#8b5cf6', 0.25), bgcolor: alpha('#8b5cf6', 0.06), mt: 0.5 }}>
          <Typography variant="caption2" sx={{ color: 'text.secondary' }}>Root Cause</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {summary.rootCause}
            {summary.rootCauseConfidence > 0 && (
              <Typography component="span" variant="caption2" sx={{ ml: 0.75, color: '#8b5cf6' }}>
                ({summary.rootCauseConfidence}%)
              </Typography>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>Predicted Risks</Typography>
            {summary.predictedRisks.map((r) => (
              <Typography key={r} variant="caption" sx={{ display: 'block', fontWeight: 600 }}>{r}</Typography>
            ))}
          </Box>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>Recommended Priority</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#f59e0b' }}>{summary.recommendedPriority}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download size={14} />}
            onClick={() => downloadDailyReport(toDailyReportJson(summary, services, incidents))}
            sx={{ fontSize: 11 }}
          >
            Export JSON
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            <FileText size={12} color="#8b93a8" />
            <Typography variant="caption2" sx={{ color: 'text.disabled' }}>
              Generated {new Date(summary.generatedAt).toLocaleTimeString()}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Panel>
  )
}

export default memo(ExecutiveSummaryCard)
