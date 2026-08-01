import styles from './obs.module.css'

export type TraceNode = {
  id: string
  label: string
  x: number
  y: number
  latency: number
}

export default function TracingGraph({
  nodes,
  edges,
}: {
  nodes: TraceNode[]
  edges: Array<[string, string]>
}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

  return (
    <div className={styles.traceCanvas} role="img" aria-label="Distributed tracing graph">
      <svg className={styles.traceSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map(([a, b]) => {
          const na = byId[a]
          const nb = byId[b]
          if (!na || !nb) return null
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="rgba(6,182,212,0.45)"
              strokeWidth="0.55"
            />
          )
        })}
        {nodes.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x - 9}
              y={n.y - 6}
              width="18"
              height="12"
              rx="2"
              fill="rgba(22,27,39,0.95)"
              stroke="rgba(6,182,212,0.45)"
              strokeWidth="0.4"
            />
            <text
              x={n.x}
              y={n.y - 0.8}
              textAnchor="middle"
              fill="#e8eaf0"
              fontSize="2.6"
              fontWeight="700"
            >
              {n.label}
            </text>
            <text
              x={n.x}
              y={n.y + 2.8}
              textAnchor="middle"
              fill="#06b6d4"
              fontSize="2.2"
              fontWeight="650"
            >
              {n.latency > 0 ? `${n.latency}ms` : 'origin'}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
