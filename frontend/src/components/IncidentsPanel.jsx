function money(n) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function IncidentsPanel({ incidents, onSelect, selectedId }) {
  return (
    <div className="incidents">
      <div className="feed-head">
        <h2>Bank alerts (secure API)</h2>
        <span className="feed-count">{incidents.length}</span>
      </div>
      {incidents.length === 0 && <p className="muted pad">No holds triggered yet. Run a scam scenario to see a bank alert.</p>}
      {incidents.map((i) => (
        <button
          className={`incident ${selectedId === i.id ? 'selected' : ''}`}
          key={i.id}
          onClick={() => onSelect?.(i.id)}
        >
          <div className="incident-head">
            <span className="incident-id">{i.id}</span>
            <span className="tag tag-hold">HOLD</span>
          </div>
          <div className="incident-body">
            <span>{i.payer} → {i.beneficiary}</span>
            <span className="muted">{money(i.amount)} · score {i.score.toFixed(0)}</span>
          </div>
          <div className="incident-foot">
            <span className="muted small">{fmtTime(i.created_at)}</span>
            <span className="delivered">DELIVERED · {i.channel}</span>
          </div>
        </button>
      ))}
    </div>
  )
}