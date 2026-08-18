import styles from './obs.module.css'

type Region = {
  id: string
  label: string
  x: number
  y: number
  status: 'Healthy' | 'Warning' | 'Critical'
}

const statusFill = {
  Healthy: '#10b981',
  Warning: '#f59e0b',
  Critical: '#ef4444',
} as const

export default function MapCard({
  regions,
  links,
}: {
  regions: Region[]
  links: Array<[string, string]>
}) {
  const byId = Object.fromEntries(regions.map((r) => [r.id, r]))

  return (
    <div className={styles.mapCard} role="img" aria-label="Infrastructure region map">
      <svg className={styles.mapSvg} viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="ocean" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="var(--cc-elevated)" />
            <stop offset="100%" stopColor="var(--cc-bg)" />
          </radialGradient>
        </defs>
        <rect width="100" height="70" fill="url(#ocean)" />
        {/* stylized continents */}
        <path
          d="M12 28 C18 22, 28 24, 34 30 C38 34, 36 42, 30 44 C22 46, 14 40, 12 28 Z"
          fill="var(--cc-hover)"
          stroke="var(--cc-border-strong)"
          strokeWidth="0.3"
        />
        <path
          d="M42 18 C52 14, 62 16, 68 24 C72 30, 70 38, 62 40 C52 42, 44 34, 42 18 Z"
          fill="var(--cc-hover)"
          stroke="var(--cc-border-strong)"
          strokeWidth="0.3"
        />
        <path
          d="M66 40 C74 38, 84 42, 88 50 C90 56, 84 60, 76 58 C68 56, 64 48, 66 40 Z"
          fill="var(--cc-hover)"
          stroke="var(--cc-border-strong)"
          strokeWidth="0.3"
        />

        {links.map(([a, b]) => {
          const ra = byId[a]
          const rb = byId[b]
          if (!ra || !rb) return null
          return (
            <line
              key={`${a}-${b}`}
              x1={ra.x}
              y1={ra.y}
              x2={rb.x}
              y2={rb.y}
              stroke="rgba(6,182,212,0.35)"
              strokeWidth="0.4"
              strokeDasharray="1.2 1"
            />
          )
        })}

        {regions.map((r) => (
          <g key={r.id}>
            <circle
              cx={r.x}
              cy={r.y}
              r="2.2"
              fill={statusFill[r.status]}
              opacity="0.25"
            />
            <circle
              cx={r.x}
              cy={r.y}
              r="1.2"
              fill={statusFill[r.status]}
              stroke="var(--cc-bg)"
              strokeWidth="0.3"
            />
            <text className={styles.nodeLabel} x={r.x} y={r.y - 2.8} textAnchor="middle">
              {r.label}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.mapLegend}>
        <span className={styles.mapLegendItem}>
          <span className={`${styles.healthDot} ${styles.dotSuccess}`} /> Healthy
        </span>
        <span className={styles.mapLegendItem}>
          <span className={`${styles.healthDot} ${styles.dotWarning}`} /> Warning
        </span>
        <span className={styles.mapLegendItem}>
          <span className={`${styles.healthDot} ${styles.dotError}`} /> Critical
        </span>
      </div>
    </div>
  )
}
