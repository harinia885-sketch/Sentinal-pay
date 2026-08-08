const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'transactions', label: 'Transactions', icon: '⇄' },
  { id: 'incidents', label: 'Incidents', icon: '⚠' },
  { id: 'analytics', label: 'Analytics', icon: '▤' },
]

export default function Sidebar({ active, onSelect }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="logo">◈</span>
        <span className="sidebar-title">SentinelPay</span>
      </div>
      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`sidebar-link ${active === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}