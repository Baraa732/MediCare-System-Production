import { Component, type ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { isStaleChunkError, reloadOnceOnStaleChunk } from '../../lib/staleChunk'

interface Props { children: ReactNode; resetKey?: string }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }

  componentDidCatch(error: Error) {
    if (isStaleChunkError(error)) {
      reloadOnceOnStaleChunk(error)
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      const stale = isStaleChunkError(this.state.error)
      return (
        <Box sx={{ p: 4, textAlign: 'center', color: 'var(--cc-text)', bgcolor: 'var(--cc-surface)', minHeight: 280, borderRadius: '14px', border: '1px solid var(--cc-border-strong)' }}>
          <AlertTriangle size={32} color="#ef4444" />
          <Typography variant="h3" sx={{ mt: 2, mb: 1, color: 'var(--cc-text)' }}>
            {stale ? 'Dashboard updated' : 'Something went wrong'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--cc-muted)', mb: 3 }}>
            {stale
              ? 'A new version was deployed. Reload to load the latest page assets.'
              : this.state.error?.message}
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshCw size={14} />}
            onClick={() => {
              if (stale) {
                window.location.reload()
                return
              }
              this.setState({ hasError: false, error: null })
            }}
          >
            {stale ? 'Reload' : 'Try again'}
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}
