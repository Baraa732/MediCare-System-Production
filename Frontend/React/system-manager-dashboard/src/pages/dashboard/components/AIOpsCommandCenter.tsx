import { memo } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Chip, Grid, Typography } from '@mui/material'
import { Brain, ShieldAlert, Sparkles, Target, TrendingUp } from 'lucide-react'
import type { AIOpsSnapshot } from '../../../lib/aiopsEngine'
import { Panel } from './DashboardPanels'

const KIND_ICON = {
  anomaly: Sparkles,
  prediction: TrendingUp,
  root_cause: Target,
  action: ShieldAlert,
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Brain; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
      <Icon size={13} color="var(--cc-muted)" />
      <Typography variant="caption2" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
    </Box>
  )
}

function InsightRow({ insight }: { insight: AIOpsSnapshot['insights'][number] }) {
  const Icon = KIND_ICON[insight.kind] ?? Sparkles
  return (
    <Box
      sx={{
        p: 1.1,
        borderRadius: '4px',
        border: `1px solid ${alpha(insight.color, 0.28)}`,
        bgcolor: alpha(insight.color, 0.06),
        borderLeft: `3px solid ${insight.color}`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Icon size={14} color={insight.color} style={{ marginTop: 2, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{insight.message}</Typography>
          {insight.recommendedAction && (
            <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mt: 0.35 }}>
              → {insight.recommendedAction}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.65, flexWrap: 'wrap' }}>
            <Chip label={`${insight.confidence}% confidence`} size="small" sx={{ height: 20, fontSize: 10, color: insight.color, bgcolor: alpha(insight.color, 0.12) }} />
            <Chip label={insight.severity} size="small" sx={{ height: 20, fontSize: 10, color: 'text.secondary', bgcolor: alpha('#8b93a8', 0.12) }} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function AIOpsCommandCenter({ snapshot }: { snapshot: AIOpsSnapshot }) {
  const { anomalies, predictions, rootCauses, insights } = snapshot

  return (
    <Panel title="AIOps Command Center" caption="anomalies · predictions · root cause · recommended actions">
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 3 }}>
          <SectionLabel icon={Sparkles} label="Active Anomalies" />
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {anomalies.slice(0, 3).map((a) => (
              <Typography key={a.id} variant="caption2" sx={{ color: 'text.primary' }}>
                • {a.message}
              </Typography>
            ))}
            {!anomalies.length && (
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No anomalies detected.</Typography>
            )}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SectionLabel icon={TrendingUp} label="Predicted Failures" />
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {predictions.slice(0, 3).map((p) => (
              <Typography key={p.id} variant="caption2" sx={{ color: p.severity === 'critical' ? '#ef4444' : 'text.primary' }}>
                • {p.message}
              </Typography>
            ))}
            {!predictions.length && (
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No pre-failure signals.</Typography>
            )}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SectionLabel icon={Target} label="Root Causes" />
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {rootCauses.slice(0, 2).map((rc) => (
              <Typography key={rc.service} variant="caption2" sx={{ color: 'text.primary' }}>
                • {rc.probableRootCause} ({rc.confidence}%)
              </Typography>
            ))}
            {!rootCauses.length && (
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No root cause ranked yet.</Typography>
            )}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SectionLabel icon={ShieldAlert} label="Recommended Actions" />
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {snapshot.remediationForTop.slice(0, 3).map((a) => (
              <Typography key={a.id} variant="caption2" sx={{ color: 'text.primary' }}>
                • {a.title}
              </Typography>
            ))}
          </Box>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <SectionLabel icon={Brain} label="Priority Insights" />
          <Box sx={{ display: 'grid', gap: 1 }}>
            {insights.slice(0, 4).map((insight) => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
            {!insights.length && (
              <Typography variant="caption2" sx={{ color: 'text.secondary', textAlign: 'center', py: 1 }}>
                Platform telemetry stable — no AIOps actions required.
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </Panel>
  )
}

export default memo(AIOpsCommandCenter)
