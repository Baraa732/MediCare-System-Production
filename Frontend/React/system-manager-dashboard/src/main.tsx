import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { darkTheme, lightTheme } from './theme'
import { useUIStore } from './store/uiStore'
import App from './App'
import QueryProvider from './providers/QueryProvider'

function ThemedApp() {
  const themeMode = useUIStore((s) => s.themeMode)
  const theme = themeMode === 'dark' ? darkTheme : lightTheme
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryProvider>
        <App />
      </QueryProvider>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemedApp />
  </StrictMode>,
)
