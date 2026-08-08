function money(n) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export default function IncidentDrawer({ incident, onClose }) {
  if (!incident) return null

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h2>Alert {incident.id}</h2>
            <span className="muted">{fmtTime(incident.created_at)}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-score" style={{ borderColor: '#dc2626' }}>
          <span className="drawer-score-num" style={{ color: '#dc2626' }}>{incident.score.toFixed(1)}</span>
          <span className="tag tag-hold" style={{ background: '#dc26261f', color: '#dc2626' }}>HOLD</span>
          <span className="drawer-score-label">Delivered via {incident.channel}</span>
        </div>

        <div className="drawer-grid">
          <div className="kv"><span>Payer</span><b>{incident.payer || '—'}</b></div>
          <div className="kv"><span>Beneficiary</span><b>{incident.beneficiary || '—'}</b></div>
          <div className="kv"><span>Amount</span><b>{money(incident.amount)}</b></div>
          <div className="kv"><span>Channel</span><b>{incident.channel || '—'}</b></div>
          <div className="kv"><span>Status</span><b>DELIVERED</b></div>
          <div className="kv"><span>Alert ID</span><b>{incident.id}</b></div>
        </div>

        {incident.txn_id && (
          <p className="explanation">Linked transaction: {incident.txn_id}</p>
        )}
      </div>
    </>
  )
}