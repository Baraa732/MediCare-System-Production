import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { HudMarker } from './HudGeoMap'
import styles from './hudGlobe.module.css'

const STATUS_COLOR = {
  ok: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
} as const

/** Slippy dark basemap tiles draped onto the 3D globe (map structure). */
function darkMapTileUrl(x: number, y: number, l: number) {
  const s = ['a', 'b', 'c', 'd'][(x + y) % 4]
  return `https://${s}.basemaps.cartocdn.com/dark_all/${l}/${x}/${y}.png`
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
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reduced = usePrefersReducedMotion()
  const [size, setSize] = useState({ width: 0, height: 0 })

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

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const sync = () => {
      setSize({ width: stage.clientWidth, height: stage.clientHeight })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !markers.length) return

    const lat = markers.reduce((s, m) => s + m.lat, 0) / markers.length
    const lng = markers.reduce((s, m) => s + m.lng, 0) / markers.length
    globe.pointOfView({ lat, lng, altitude: 1.85 }, 0)

    const controls = globe.controls()
    controls.autoRotate = !reduced
    controls.autoRotateSpeed = 0.55
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 120
    controls.maxDistance = 480
  }, [markers, reduced, size.width, size.height])

  if (!markers.length) {
    return (
      <div className={styles.stage} role="img" aria-label={title}>
        <div className={styles.empty}>{emptyHint}</div>
      </div>
    )
  }

  return (
    <div className={styles.stage} ref={stageRef} role="img" aria-label={title}>
      <div className={styles.globeHost}>
        {size.width > 0 && size.height > 0 ? (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(0,0,0,0)"
            backgroundImageUrl="/globe/night-sky.png"
            globeImageUrl="/globe/earth-night.jpg"
            bumpImageUrl="/globe/earth-topology.png"
            globeTileEngineUrl={darkMapTileUrl}
            showAtmosphere
            atmosphereColor="#06b6d4"
            atmosphereAltitude={0.18}
            showGraticules
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude="altitude"
            pointRadius="radius"
            pointLabel={(d: object) => {
              const p = d as HudMarker
              return `<div style="font:12px/1.35 Inter,system-ui,sans-serif">
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
            arcAltitudeAutoScale={0.35}
            arcStroke={0.45}
            arcDashLength={0.45}
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
        ) : null}
      </div>

      <div className={styles.vignette} aria-hidden />

      <div className={`${styles.hud} ${styles.topLeft}`}>
        {title}
        <div className={styles.active}>{subtitle}</div>
      </div>
      <div className={`${styles.hud} ${styles.topRight}`}>
        3D MAP · NODES {markers.length}
      </div>

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
