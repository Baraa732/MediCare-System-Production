import { Component, type ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode; resetKey?: string }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center', color: '#e8eaf0', bgcolor: '#12151f', minHeight: 280, borderRadius: '14px', border: '1px solid #2a3147' }}>
          <AlertTriangle size={32} color="#ef4444" />
          <Typography variant="h3" sx={{ mt: 2, mb: 1, color: '#e8eaf0' }}>Something went wrong</Typography>
          <Typography variant="body2" sx={{ color: '#8b93a8', mb: 3 }}>{this.state.error?.message}</Typography>
          <Button variant="contained" onClick={() => this.setState({ hasError: false, error: null })}>Try again</Button>
        </Box>
      )
    }
    return this.props.children
  }
}
