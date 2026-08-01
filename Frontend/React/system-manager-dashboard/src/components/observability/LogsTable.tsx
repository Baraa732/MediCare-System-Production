import { useMemo, useState } from 'react'
import LiveIndicator from './LiveIndicator'
import SearchField from './SearchField'
import styles from './obs.module.css'

type Log = {
  ts: string
  level: string
  service: string
  message: string
}

const levelClass: Record<string, string> = {
  ERROR: styles.levelError,
  WARN: styles.levelWarn,
  INFO: styles.levelInfo,
  DEBUG: styles.levelDebug,
}

export default function LogsTable({ logs }: { logs: Log[] }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return logs
    return logs.filter(
      (l) =>
        l.message.toLowerCase().includes(needle) ||
        l.service.toLowerCase().includes(needle) ||
        l.level.toLowerCase().includes(needle),
    )
  }, [logs, q])

  return (
    <div className={styles.stack}>
      <div className={styles.logsToolbar}>
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search logs…"
          ariaLabel="Search system logs"
        />
        <LiveIndicator />
      </div>
      <div className={`${styles.tableWrap} ${styles.scrollY}`} role="region" aria-label="System logs">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Level</th>
              <th scope="col">Service</th>
              <th scope="col">Message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={`${l.ts}-${i}`} tabIndex={0}>
                <td className={styles.logTs}>{l.ts}</td>
                <td className={levelClass[l.level] ?? styles.levelDebug}>{l.level}</td>
                <td className={styles.strong}>{l.service}</td>
                <td className={styles.logMsg}>{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
