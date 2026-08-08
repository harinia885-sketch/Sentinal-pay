import { useMemo } from 'react'

const TIER_COLORS = { allow: '#16a34a', warn: '#ca8a04', verify: '#d97706', hold: '#dc2626' }

function ScoreTrendChart({ txns }) {
  const data = txns.slice(0, 40).reverse()
  const W = 640
  const H = 210
  const padL = 34
  const padR = 10
  const padT = 12
  const padB = 22
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const x = (i) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (s) => padT + plotH - (Math.min(100, Math.max(0, s)) / 100) * plotH

  const line = data.map((t, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(t.score).toFixed(1)}`).join(' ')
  const area = data.length ? `${line} L ${x(data.length - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z` : ''

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Risk score trend">
      <defs>
        <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 30, 50, 70, 100].map((v) => (
        <line
          key={v}
          x1={padL}
          x2={W - padR}
          y1={y(v)}
          y2={y(v)}
          stroke={v === 0 ? '#24304f' : v === 70 ? '#dc2626' : '#24304f'}
          strokeOpacity={v === 0 ? 1 : 0.45}
          strokeDasharray={v === 0 ? '' : '4 4'}
        />
      ))}
      {[30, 50, 70, 100].map((v) => (
        <text key={v} x={padL - 6} y={y(v) + 3} textAnchor="end" className="chart-tick">
          {v}
        </text>
      ))}
      {data.length > 1 && <path d={area} fill="url(#scoreArea)" />}
      {data.length > 1 && <path d={line} fill="none" stroke="#4f8cff" strokeWidth={2} />}
      {data.map((t, i) => (
        <circle key={t.txn_id} cx={x(i)} cy={y(t.score)} r={3} fill={TIER_COLORS[t.tier] || '#4f8cff'} />
      ))}
    </svg>
  )
}

function HourlyChart({ txns }) {
  const buckets = useMemo(() => {
    const b = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, hold: 0 }))
    for (const t of txns) {
      const h = Math.min(23, Math.max(0, Math.round(t.signals?.txn_hour ?? 12)))
      b[h].total += 1
      if (t.tier === 'hold') b[h].hold += 1
    }
    return b
  }, [txns])

  const max = Math.max(1, ...buckets.map((b) => b.total))
  const W = 300
  const H = 150
  const padB = 20
  const padT = 8
  const bw = W / 24

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Transactions by hour">
      {buckets.map((b) => {
        const h = (b.total / max) * (H - padB - padT)
        const hasHold = b.hold > 0
        return (
          <g key={b.hour}>
            <rect
              x={b.hour * bw + 1}
              y={H - padB - h}
              width={bw - 2}
              height={h}
              rx={1.5}
              fill={hasHold ? '#dc2626' : '#4f8cff'}
              opacity={hasHold ? 0.95 : 0.55}
            />
            {b.hour % 6 === 0 && (
              <text x={b.hour * bw + bw / 2} y={H - 6} textAnchor="middle" className="chart-tick">
                {b.hour}
              </text>
            )}
          </g>
        )
      })}
      <text x={W - 4} y={H - 6} textAnchor="end" className="chart-tick">
        hour (IST)
      </text>
    </svg>
  )
}

function TierDonut({ txns }) {
  const dist = useMemo(() => {
    const d = { allow: 0, warn: 0, verify: 0, hold: 0 }
    for (const t of txns) if (d[t.tier] != null) d[t.tier] += 1
    return d
  }, [txns])
  const total = Math.max(1, txns.length)
  const r = 52
  const C = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" className="chart donut" role="img" aria-label="Tier distribution">
        <circle cx={80} cy={80} r={r} fill="none" stroke="#182140" strokeWidth={18} />
        {Object.entries(dist).map(([tier, count]) => {
          if (!count) return null
          const frac = count / total
          const dash = frac * C
          const offset = -acc * C
          acc += frac
          return (
            <circle
              key={tier}
              cx={80}
              cy={80}
              r={r}
              fill="none"
              stroke={TIER_COLORS[tier]}
              strokeWidth={18}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90 80 80)"
            />
          )
        })}
        <text x={80} y={76} textAnchor="middle" className="donut-total">{txns.length}</text>
        <text x={80} y={94} textAnchor="middle" className="donut-sub">txns</text>
      </svg>
      <div className="donut-legend">
        {Object.entries(dist).map(([tier, count]) => (
          <div className="legend-row" key={tier}>
            <span className="legend-dot" style={{ background: TIER_COLORS[tier] }} />
            <span className="legend-name">{tier}</span>
            <span className="legend-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopSignals({ txns }) {
  const counts = useMemo(() => {
    const c = {}
    for (const t of txns) {
      for (const contrib of t.contributions || []) {
        c[contrib.label] = (c[contrib.label] || 0) + 1
      }
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [txns])
  const max = Math.max(1, ...counts.map(([, n]) => n))

  return (
    <div className="top-signals">
      {counts.length === 0 && <p className="muted small">No signals yet — run scenarios to populate.</p>}
      {counts.map(([label, n]) => (
        <div className="signal-row" key={label}>
          <div className="signal-head">
            <span className="signal-name">{label}</span>
            <span className="signal-count">{n}</span>
          </div>
          <div className="signal-track">
            <div
              className="signal-fill"
              style={{ width: `${(n / max) * 100}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Analytics({ transactions }) {
  return (
    <section className="analytics">
      <div className="analytics-head">
        <h2>Analytics</h2>
        <span className="muted small">live · computed from the current stream</span>
      </div>
      <div className="analytics-grid">
        <div className="panel chart-card span2">
          <h3 className="chart-title">Risk score trend (last 40)</h3>
          <ScoreTrendChart txns={transactions} />
          <div className="threshold-legend">
            <span><i style={{ background: '#16a34a' }} /> &lt;30 allow</span>
            <span><i style={{ background: '#ca8a04' }} /> 30–49 warn</span>
            <span><i style={{ background: '#d97706' }} /> 50–69 verify</span>
            <span><i style={{ background: '#dc2626' }} /> ≥70 hold</span>
          </div>
        </div>
        <div className="panel chart-card">
          <h3 className="chart-title">Tier distribution</h3>
          <TierDonut txns={transactions} />
        </div>
        <div className="panel chart-card span2">
          <h3 className="chart-title">Fraud pressure by hour</h3>
          <HourlyChart txns={transactions} />
          <p className="muted small chart-note">Red bars contain held transactions (scam pattern).</p>
        </div>
        <div className="panel chart-card">
          <h3 className="chart-title">Top signals raised</h3>
          <TopSignals txns={transactions} />
        </div>
      </div>
    </section>
  )
}