import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_FLAG = 'sm.stale-chunk-reload'
const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk [\w.-]+ failed/i

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : ''
  return STALE_CHUNK_RE.test(message)
}

function markReloadAttempt(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
    return true
  } catch {
    return true
  }
}

export function reloadOnceOnStaleChunk(error?: unknown): boolean {
  if (error != null && !isStaleChunkError(error)) return false
  if (!markReloadAttempt()) return false
  window.location.reload()
  return true
}

export function installStaleChunkReload() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnceOnStaleChunk()
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkError(event.reason)) return
    event.preventDefault()
    reloadOnceOnStaleChunk(event.reason)
  })
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      /* ignore */
    }
  }, 15_000)
}

export function lazyWithReload<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    importer().catch((error: unknown) => {
      reloadOnceOnStaleChunk(error)
      return new Promise<{ default: T }>(() => undefined)
    }),
  )
}
