function tierColor(score) {
  if (score < 30) return '#16a34a'
  if (score < 50) return '#ca8a04'
  if (score < 70) return '#d97706'
  return '#dc2626'
}

export default function MiniTrend({ transactions }) {
  const data = transactions.slice(0, 20).reverse()
  const W = 100
  const H = 100
  const padX = 4
  const padY = 8
  const plotW = W - padX * 2
  const plotH = H - padY * 2

  const x = (i) => padX + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (s) => padY + plotH - (Math.min(100, Math.max(0, s)) / 100) * plotH

  const line = data.map((t, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(t.score).toFixed(1)}`).join(' ')
  const holdCount = data.filter((t) => t.tier === 'hold').length

  return (
    <div className="mini-trend-card">
      <div className="mini-trend-head">
        <span>Score trend (last {data.length})</span>
        {holdCount > 0 && <span className="mini-trend-badge">{holdCount} held</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mini-trend-svg" preserveAspectRatio="none">
        <line x1={padX} x2={W - padX} y1={y(70)} y2={y(70)} stroke="#dc2626" strokeOpacity="0.35" strokeDasharray="3 3" />
        {data.length > 1 && <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        {data.map((t, i) => (
          <circle key={t.txn_id} cx={x(i)} cy={y(t.score)} r={2.2} fill={tierColor(t.score)} />
        ))}
        {data.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="mini-trend-empty">no data</text>
        )}
      </svg>
    </div>
  )
}