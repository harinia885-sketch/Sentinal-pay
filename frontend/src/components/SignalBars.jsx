export default function SignalBars({ contributions = [], ruleScore = 0, mlScore = 0 }) {
  const top = contributions.slice(0, 6)
  return (
    <div className="signal-bars">
      <div className="signal-meta">
        <span>
          Rule score <b>{ruleScore.toFixed(0)}</b>
        </span>
        <span>
          ML score <b>{mlScore.toFixed(0)}</b>
        </span>
      </div>
      {top.length === 0 && <p className="muted small">No risk signals raised for this transaction.</p>}
      {top.map((c) => {
        const width = Math.min(100, (c.points / 100) * 100)
        return (
          <div className="signal-row" key={`${c.signal}-${c.points}`}>
            <div className="signal-head">
              <span className="signal-name">{c.label}</span>
              <span className="signal-points">+{c.points.toFixed(0)}</span>
            </div>
            <div className="signal-track">
              <div className="signal-fill" style={{ width: `${width}%` }} />
            </div>
            <p className="signal-reason">{c.reason}</p>
          </div>
        )
      })}
    </div>
  )
}