const INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
]

export default function AutoRefresh({ interval, onChange, lastRefreshed }) {
  return (
    <div className="auto-refresh">
      <label htmlFor="refresh-interval">Auto-refresh</label>
      <select
        id="refresh-interval"
        value={interval}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {INTERVALS.map((i) => (
          <option key={i.value} value={i.value}>{i.label}</option>
        ))}
      </select>
      {interval > 0 && lastRefreshed && (
        <span className="muted small">last: {lastRefreshed}</span>
      )}
    </div>
  )
}