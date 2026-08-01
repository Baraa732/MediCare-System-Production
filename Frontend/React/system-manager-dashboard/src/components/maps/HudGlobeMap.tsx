import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { HudMarker } from './HudGeoMap'
import styles from './hudGlobe.module.css'

const STATUS_COLOR = {
  ok: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
} as const

const EARTH_NIGHT = `${import.meta.env.BASE_URL}globe/earth-night.jpg`
const EARTH_TOPO = `${import.meta.env.BASE_URL}globe/earth-topology.png`
const NIGHT_SKY = `${import.meta.env.BASE_URL}globe/night-sky.png`

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
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reduced = usePrefersReducedMotion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  /** Avoid React StrictMode first-pass WebGL teardown leaving a blank canvas. */
  const [mounted, setMounted] = useState(false)
  const [globeReady, setGlobeReady] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => {
      window.cancelAnimationFrame(id)
      setMounted(false)
      setGlobeReady(false)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const sync = () => {
      const width = Math.max(1, Math.floor(stage.clientWidth))
      const height = Math.max(1, Math.floor(stage.clientHeight))
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [mounted])

  const points = useMemo(
    () =>
      markers.map((m) => ({
        ...m,
        color: STATUS_COLOR[m.status],
        altitude: m.status === 'bad' ? 0.08 : m.status === 'warn' ? 0.05 : 0.03,
        radius: m.status === 'bad' ? 0.55 : 0.4,
      })),
    [markers],
  )

  const arcs = useMemo(() => {
    if (markers.length < 2) return []
    const hub = markers[0]
    return markers.slice(1, 8).map((m) => ({
      id: `${hub.id}-${m.id}`,
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: m.lat,
      endLng: m.lng,
      color: [STATUS_COLOR[hub.status], STATUS_COLOR[m.status]],
    }))
  }, [markers])

  const labels = useMemo(
    () =>
      markers.slice(0, 12).map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        text: m.label,
        color: STATUS_COLOR[m.status],
        size: 0.7,
      })),
    [markers],
  )

  const configureGlobe = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return

    const lat = markers.length
      ? markers.reduce((s, m) => s + m.lat, 0) / markers.length
      : 33.5
    const lng = markers.length
      ? markers.reduce((s, m) => s + m.lng, 0) / markers.length
      : 36.3

    globe.pointOfView({ lat, lng, altitude: 2.1 }, 0)

    try {
      const controls = globe.controls()
      controls.autoRotate = !reduced
      controls.autoRotateSpeed = 0.45
      controls.enableZoom = true
      controls.enablePan = false
    } catch {
      // controls may not be ready yet
    }

    setGlobeReady(true)
  }, [markers, reduced])

  useEffect(() => {
    if (!mounted || !size.width || !size.height) return
    // Re-apply POV when markers/size change after initial ready
    if (globeReady) configureGlobe()
  }, [configureGlobe, globeReady, mounted, size.height, size.width])

  const canRender = mounted && size.width > 0 && size.height > 0

  return (
    <div className={styles.stage} ref={stageRef} role="img" aria-label={title}>
      <div className={styles.globeHost}>
        {canRender ? (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="#03050a"
            backgroundImageUrl={NIGHT_SKY}
            globeImageUrl={EARTH_NIGHT}
            bumpImageUrl={EARTH_TOPO}
            showAtmosphere
            atmosphereColor="#38bdf8"
            atmosphereAltitude={0.22}
            showGraticules
            onGlobeReady={configureGlobe}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude="altitude"
            pointRadius="radius"
            pointLabel={(d: object) => {
              const p = d as HudMarker
              return `<div style="font:12px/1.35 system-ui,sans-serif;padding:2px 0">
                <strong>${p.label}</strong>
                ${p.meta ? `<div style="opacity:.75">${p.meta}</div>` : ''}
              </div>`
            }}
            arcsData={arcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcAltitudeAutoScale={0.4}
            arcStroke={0.4}
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={reduced ? 0 : 2800}
            labelsData={labels}
            labelLat="lat"
            labelLng="lng"
            labelText="text"
            labelColor="color"
            labelSize="size"
            labelDotRadius={0.28}
            labelAltitude={0.012}
            labelResolution={2}
            enablePointerInteraction
          />
        ) : (
          <div className={styles.boot}>Initializing globe…</div>
        )}
      </div>

      <div className={styles.vignette} aria-hidden />

      <div className={`${styles.hud} ${styles.topLeft}`}>
        {title}
        <div className={styles.active}>{subtitle}</div>
      </div>
      <div className={`${styles.hud} ${styles.topRight}`}>
        3D MAP · NODES {markers.length}
      </div>

      {!markers.length ? (
        <div className={styles.emptyOverlay}>{emptyHint}</div>
      ) : null}

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
