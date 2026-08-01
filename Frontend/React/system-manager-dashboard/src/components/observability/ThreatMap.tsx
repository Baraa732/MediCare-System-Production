import styles from './obs.module.css'

export default function ThreatMap({
  points,
}: {
  points: Array<{ x: number; y: number; intensity: number }>
}) {
  return (
    <div
      className={`${styles.mapCard} ${styles.threatMap}`}
      role="img"
      aria-label="Security threat map"
    >
      <svg className={styles.mapSvg} viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="60" fill="#0d1018" />
        <path
          d="M10 25 C20 18, 35 20, 42 28 C48 34, 40 42, 28 44 C16 46, 8 36, 10 25 Z"
          fill="#1c2538"
        />
        <path
          d="M48 16 C60 12, 74 18, 78 28 C80 36, 70 42, 58 40 C48 38, 44 26, 48 16 Z"
          fill="#1c2538"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3 + p.intensity * 4}
              fill={`rgba(239,68,68,${0.12 + p.intensity * 0.2})`}
            />
            <circle cx={p.x} cy={p.y} r="1.2" fill="#ef4444" />
          </g>
        ))}
      </svg>
    </div>
  )
}
