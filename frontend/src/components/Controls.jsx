import { useState } from 'react'

export default function Controls({ running, cadence, scenarios, onStart, onPause, onCadence, onScenario }) {
  const [scenario, setScenario] = useState('scam_otp_relay')
  const [busy, setBusy] = useState(false)

  const run = () => {
    setBusy(true)
    onScenario(scenario)
    setTimeout(() => setBusy(false), 900)
  }

  return (
    <div className="controls">
      <button
        className={`btn-primary ${running ? 'is-paused' : ''}`}
        onClick={running ? onPause : onStart}
      >
        {running ? '❚❚ Pause stream' : '▶ Start live stream'}
      </button>

      <div className="control-group">
        <label htmlFor="cadence">Cadence {cadence.toFixed(1)}s</label>
        <input
          id="cadence"
          type="range"
          min={0.3}
          max={5}
          step={0.1}
          value={cadence}
          onChange={(e) => onCadence(Number(e.target.value))}
        />
      </div>

      <div className="control-group select-group">
        <label htmlFor="scenario">Scenario</label>
        <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {scenarios.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <button className="btn-ghost" disabled={busy} onClick={run}>
        {busy ? 'Running…' : 'Run scenario now'}
      </button>
    </div>
  )
}