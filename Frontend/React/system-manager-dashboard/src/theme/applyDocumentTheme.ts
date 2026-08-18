export type ThemeMode = 'dark' | 'light'

export function applyDocumentTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
}

export function readPersistedTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem('obsadmin-ui-v1')
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw) as { state?: { themeMode?: string } }
    return parsed.state?.themeMode === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}
