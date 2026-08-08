export default function StatsBar({ stats }) {
  if (!stats) return null
  const items = [
    { label: 'Transactions', value: stats.total, color: '#8b96b8' },
    { label: 'Allowed', value: stats.allow, color: '#16a34a' },
    { label: 'Warned', value: stats.warn, color: '#ca8a04' },
    { label: 'Verified', value: stats.verify, color: '#d97706' },
    { label: 'Held + alerted', value: stats.hold, color: '#dc2626' },
    { label: 'Avg score', value: stats.avg_score?.toFixed(1), color: '#8b96b8' },
  ]
  return (
    <div className="stats-bar">
      {items.map((i) => (
        <div className="stat" key={i.label}>
          <span className="stat-value" style={{ color: i.color }}>{i.value}</span>
          <span className="stat-label">{i.label}</span>
        </div>
      ))}
    </div>
  )
}