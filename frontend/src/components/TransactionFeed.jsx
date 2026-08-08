import { useMemo, useState } from 'react'

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

function money(n) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const SCENARIO_LABELS = {
  legit_regular: 'Legit · regular',
  legit_new_merchant: 'Legit · new merchant',
  legit_urgent_family: 'Legit · family emergency',
  scam_otp_relay: 'SCAM · OTP relay',
  scam_voice_clone: 'SCAM · voice clone',
  scam_urgent_new_beneficiary: 'SCAM · urgent + new ben',
  edge_drained_account: 'SCAM · account drain',
  live: 'live',
}

const TIERS = ['all', 'allow', 'warn', 'verify', 'hold']

export default function TransactionFeed({ transactions, onSelect, selectedId }) {
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((t) => {
      if (tierFilter !== 'all' && t.tier !== tierFilter) return false
      if (!q) return true
      const payer = (t.signals?.payer || '').toLowerCase()
      const ben = (t.signals?.beneficiary || '').toLowerCase()
      const id = (t.txn_id || '').toLowerCase()
      return payer.includes(q) || ben.includes(q) || id.includes(q)
    })
  }, [transactions, query, tierFilter])

  return (
    <div className="feed">
      <div className="feed-head">
        <h2>Live transaction stream</h2>
        <span className="feed-count">{filtered.length}/{transactions.length}</span>
      </div>

      <div className="feed-filters">
        <input
          className="feed-search"
          type="text"
          placeholder="Search payer, beneficiary, txn id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="feed-tier-tabs">
          {TIERS.map((tier) => (
            <button
              key={tier}
              className={`feed-tier-tab ${tierFilter === tier ? 'active' : ''} tab-${tier}`}
              onClick={() => setTierFilter(tier)}
            >
              {tier === 'all' ? 'All' : tier}
            </button>
          ))}
        </div>
      </div>

      <div className="feed-table">
        <div className="feed-row feed-th">
          <span>Time</span>
          <span>Payer → Beneficiary</span>
          <span>Amount</span>
          <span>Score</span>
          <span>Action</span>
        </div>
        {filtered.length === 0 && <p className="muted pad">No transactions match this filter.</p>}
        {filtered.map((t) => (
          <button
            key={t.txn_id}
            className={`feed-row feed-tr ${selectedId === t.txn_id ? 'selected' : ''}`}
            onClick={() => onSelect(t.txn_id)}
          >
            <span className="muted">{fmtTime(t.created_at)}</span>
            <span className="feed-pair">
              <span>{t.signals?.payer || '—'}</span>
              <span className="muted">→ {t.signals?.beneficiary || '—'}</span>
            </span>
            <span>{money(t.signals?.amount)}</span>
            <span>
              <span className={`pill tier-${t.tier}`} style={{ borderColor: t.tier_color, color: t.tier_color }}>
                {t.score.toFixed(0)}
              </span>
            </span>
            <span>
              <span className={`tag tag-${t.tier}`} style={{ background: `${t.tier_color}1f`, color: t.tier_color }}>
                {t.tier}
              </span>
              <span className="scenario-label">{SCENARIO_LABELS[t.scenario] || t.scenario}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}