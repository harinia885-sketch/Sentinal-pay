export default function Header({ connected, running, modelVersion, theme, onToggleTheme }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">◈</span>
        <div>
          <h1>SentinelPay</h1>
          <p className="tagline">Real-Time UPI Fraud Intervention Engine</p>
        </div>
      </div>
      <div className="header-meta">
        <span className={`status-pill ${connected ? (running ? 'live' : 'ready') : 'down'}`}>
          <span className="dot" />
          {!connected ? 'OFFLINE' : running ? 'LIVE' : 'READY'}
        </span>
        {modelVersion && <span className="muted small">ML model v{modelVersion}</span>}
        <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}