import { useEffect, useMemo, useRef } from 'react'
import createGlobe, { type COBEOptions } from 'cobe'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { HudMarker } from './HudGeoMap'
import styles from './hudGlobe.module.css'

type GlobeOptions = COBEOptions & {
  onRender?: (state: Record<string, unknown>) => void
}

const statusRgb = {
  ok: [0.06, 0.72, 0.5] as [number, number, number],
  warn: [0.96, 0.62, 0.05] as [number, number, number],
  bad: [0.94, 0.27, 0.27] as [number, number, number],
}

function toMarkerSize(status: HudMarker['status']) {
  if (status === 'bad') return 0.08
  if (status === 'warn') return 0.06
  return 0.045
}

export default function HudGlobeMap({
  markers,
  title = 'CLINIC FLEET',
  subtitle = 'ACTIVE',
  emptyHint = 'No clinics with latitude/longitude yet',
}: {
  markers: HudMarker[]
  title?: string
  subtitle?: string
  emptyHint?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef({ x: 0, dragging: false, lastX: 0 })
  const reduced = usePrefersReducedMotion()

  const cobeMarkers = useMemo(
    () =>
      markers.map((m) => ({
        location: [m.lat, m.lng] as [number, number],
        size: toMarkerSize(m.status),
        color: statusRgb[m.status],
        id: m.id,
      })),
    [markers],
  )

  const arcs = useMemo(() => {
    if (markers.length < 2) return []
    const hub = markers[0]
    return markers.slice(1, 8).map((m) => ({
      from: [hub.lat, hub.lng] as [number, number],
      to: [m.lat, m.lng] as [number, number],
      color: statusRgb[m.status],
      id: `${hub.id}-${m.id}`,
    }))
  }, [markers])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage || !markers.length) return

    let phi = 0.4
    let globe: ReturnType<typeof createGlobe> | undefined

    const syncSize = () => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      canvas.width = width * 2
      canvas.height = height * 2
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    syncSize()

    const options: GlobeOptions = {
      devicePixelRatio: 2,
      width: canvas.width,
      height: canvas.height,
      phi: 0,
      theta: 0.22,
      dark: 1,
      diffuse: 1.35,
      mapSamples: 18000,
      mapBrightness: 5.2,
      baseColor: [0.07, 0.12, 0.22],
      markerColor: [0.05, 0.78, 0.86],
      glowColor: [0.08, 0.45, 0.65],
      markers: cobeMarkers,
      arcs,
      arcColor: [0.05, 0.78, 0.86],
      arcWidth: 0.35,
      arcHeight: 0.28,
      markerElevation: 0.02,
      scale: 1.12,
      offset: [0, 0],
      onRender: (state) => {
        state.width = canvas.width
        state.height = canvas.height
        if (!reduced && !pointerRef.current.dragging) {
          phi += 0.0032
        }
        state.phi = phi + pointerRef.current.x
      },
    }

    globe = createGlobe(canvas, options as COBEOptions)

    const ro = new ResizeObserver(() => {
      syncSize()
    })
    ro.observe(stage)

    return () => {
      ro.disconnect()
      globe?.destroy()
    }
  }, [arcs, cobeMarkers, markers.length, reduced])

  const onPointerDown = (e: React.PointerEvent) => {
    pointerRef.current.dragging = true
    pointerRef.current.lastX = e.clientX
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerRef.current.dragging) return
    const dx = e.clientX - pointerRef.current.lastX
    pointerRef.current.lastX = e.clientX
    pointerRef.current.x += dx / 220
  }

  const onPointerUp = () => {
    pointerRef.current.dragging = false
  }

  if (!markers.length) {
    return (
      <div className={styles.stage} role="img" aria-label={title}>
        <div className={styles.empty}>{emptyHint}</div>
      </div>
    )
  }

  return (
    <div
      className={styles.stage}
      ref={stageRef}
      role="img"
      aria-label={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className={styles.atmosphere} aria-hidden />
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.vignette} aria-hidden />

      <div className={`${styles.hud} ${styles.topLeft}`}>
        {title}
        <div className={styles.active}>{subtitle}</div>
      </div>
      <div className={`${styles.hud} ${styles.topRight}`}>NODES {markers.length}</div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotOk}`} /> Healthy
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotWarn}`} /> Degraded
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotBad}`} /> Critical
        </span>
      </div>
    </div>
  )
}
