const ZONES = [
  { from: 0, to: 30, color: '#22c55e', label: 'Allow' },
  { from: 30, to: 50, color: '#f59e0b', label: 'Warn' },
  { from: 50, to: 70, color: '#f97316', label: 'Verify' },
  { from: 70, to: 100, color: '#ef4444', label: 'Hold' },
]

function polar(value) {
  const theta = 180 - (value / 100) * 180 // 0 -> left, 100 -> right
  const rad = (theta * Math.PI) / 180
  return { x: 150 + 126 * Math.cos(rad), y: 150 - 126 * Math.sin(rad) }
}

function arcPath(v0, v1) {
  const a = polar(v0)
  const b = polar(v1)
  const large = v1 - v0 > 50 ? 1 : 0
  return `M ${a.x} ${a.y} A 126 126 0 ${large} 1 ${b.x} ${b.y}`
}

export default function RiskGauge({ score = 0, tier = 'allow', label = '' }) {
  const clamped = Math.min(100, Math.max(0, score))
  const activeColor = ZONES.find((z) => clamped < z.to)?.color || '#ef4444'
  const needleAngle = (clamped - 50) * 1.8 // -90 (left) .. +90 (right)

  return (
    <svg viewBox="0 0 300 170" className="gauge" role="img" aria-label={`Risk score ${clamped}`}>
      <defs>
        <radialGradient id="gaugeHub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e7ecff" />
          <stop offset="100%" stopColor="#4f8cff" />
        </radialGradient>
      </defs>
      {ZONES.map((z) => (
        <path key={z.label} d={arcPath(z.from, z.to)} fill="none" stroke={z.color} strokeWidth={17} strokeLinecap="round" opacity={0.18} />
      ))}
      <path
        d={arcPath(0, clamped)}
        fill="none"
        stroke={activeColor}
        strokeWidth={17}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
      />
      <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '150px 150px', transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <line x1={150} y1={150} x2={150} y2={32} stroke="#e7ecff" strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <circle cx={150} cy={150} r={7} fill="url(#gaugeHub)" />
      <circle cx={150} cy={150} r={3} fill="#0a0f1e" />
      <text x={150} y={112} textAnchor="middle" className="gauge-score" style={{ filter: 'drop-shadow(0 0 8px rgba(79,140,255,0.35))' }}>
        {clamped.toFixed(0)}
      </text>
      <text x={150} y={133} textAnchor="middle" className="gauge-tier" fill={activeColor}>
        {tier.toUpperCase()}
      </text>
      <text x={150} y={163} textAnchor="middle" className="gauge-label">
        {label || 'Risk score 0–100'}
      </text>
    </svg>
  )
}