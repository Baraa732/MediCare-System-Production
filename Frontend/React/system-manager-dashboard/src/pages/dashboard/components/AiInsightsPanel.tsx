import { memo } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Chip, Typography } from '@mui/material'
import { Sparkles } from 'lucide-react'
import type { DashboardInsight } from '../insightsEngine'
import { Panel } from './DashboardPanels'

const CONFIDENCE_COLOR = { high: '#10b981', medium: '#f59e0b', low: '#8b93a8' }
const IMPACT_COLOR = { high: '#ef4444', medium: '#f97316', low: '#06b6d4' }

function AiInsightsPanel({ insights }: { insights: DashboardInsight[] }) {
  return (
    <Panel title="AI Insights" caption="heuristic anomalies · max 3">
      <Box sx={{ display: 'grid', gap: 1 }}>
        {insights.map((insight) => (
          <Box
            key={insight.id}
            sx={{
              p: 1.25,
              borderRadius: '4px',
              border: `1px solid ${alpha(insight.color, 0.28)}`,
              bgcolor: alpha(insight.color, 0.06),
              borderLeft: `3px solid ${insight.color}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Sparkles size={14} color={insight.color} style={{ marginTop: 2, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{insight.message}</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Confidence: ${insight.confidence}`}
                    size="small"
                    sx={{ height: 20, fontSize: 10, color: CONFIDENCE_COLOR[insight.confidence], bgcolor: alpha(CONFIDENCE_COLOR[insight.confidence], 0.12) }}
                  />
                  <Chip
                    label={`Impact: ${insight.impact}`}
                    size="small"
                    sx={{ height: 20, fontSize: 10, color: IMPACT_COLOR[insight.impact], bgcolor: alpha(IMPACT_COLOR[insight.impact], 0.12) }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
        {insights.length === 0 && (
          <Typography variant="caption2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
            No anomalies detected in the current window.
          </Typography>
        )}
      </Box>
    </Panel>
  )
}

export default memo(AiInsightsPanel)
