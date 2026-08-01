import styles from './ui.module.css'

export default function Legend({
  items,
}: {
  items: { label: string; color: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#8b93a8',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: item.color,
              boxShadow: `0 0 8px ${item.color}66`,
            }}
          />
          {item.label}
        </span>
      ))}
      <span className={styles.badge + ' ' + styles.badgeMuted} style={{ display: 'none' }} />
    </div>
  )
}
