import { useEffect, useRef, useState } from 'react'
import { getTransactions, getIncidents } from './api'
import { useLiveSocket } from './hooks/useLiveSocket'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Controls from './components/Controls'
import StatsBar from './components/StatsBar'
import RiskGauge from './components/RiskGauge'
import SignalBars from './components/SignalBars'
import MiniTrend from './components/MiniTrend'
import TransactionFeed from './components/TransactionFeed'
import IncidentsPanel from './components/IncidentsPanel'
import DetailDrawer from './components/DetailDrawer'
import IncidentDrawer from './components/IncidentDrawer'
import Analytics from './components/Analytics'
import ExportPanel from './components/ExportPanel'
import AutoRefresh from './components/AutoRefresh'
import './App.css'

export default function App() {
  const sock = useLiveSocket()
  const [selectedId, setSelectedId] = useState(null)
  const [selectedIncidentId, setSelectedIncidentId] = useState(null)
  const [initTxns, setInitTxns] = useState([])
  const [initIncidents, setInitIncidents] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState('dark')
  const [refreshInterval, setRefreshInterval] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const lastAlertedId = useRef(null)

  useEffect(() => {
    if (sock.latest && sock.latest.tier === 'hold' && sock.latest.txn_id !== lastAlertedId.current) {
      lastAlertedId.current = sock.latest.txn_id

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = 880
        gain.gain.value = 0.15
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.18)
        setTimeout(() => {
          const osc2 = ctx.createOscillator()
          osc2.type = 'square'
          osc2.frequency.value = 880
          osc2.connect(gain)
          osc2.start()
          osc2.stop(ctx.currentTime + 0.18)
        }, 220)
      } catch {}

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('SentinelPay · Transaction held', {
            body: `${sock.latest.signals?.payer || 'Unknown'} → ${sock.latest.signals?.beneficiary || 'Unknown'} · score ${sock.latest.score.toFixed(0)}`,
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission()
        }
      }
    }
  }, [sock.latest])

  useEffect(() => {
    getTransactions(60).then(setInitTxns).catch(() => {})
    getIncidents(40).then(setInitIncidents).catch(() => {})
  }, [])

  useEffect(() => {
    if (!refreshInterval) return
    const id = setInterval(() => {
      getTransactions(60).then(setInitTxns).catch(() => {})
      getIncidents(40).then(setInitIncidents).catch(() => {})
      setLastRefreshed(new Date().toLocaleTimeString())
    }, refreshInterval)
    return () => clearInterval(id)
  }, [refreshInterval])

  const allTxns = sock.transactions.length ? sock.transactions : initTxns
  const incidents = sock.incidents.length ? sock.incidents : initIncidents
  const selected = allTxns.find((t) => t.txn_id === selectedId) || null
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || null

  return (
    <div className={`shell ${theme === 'light' ? 'light-theme' : ''}`}>
      <Sidebar active={activeTab} onSelect={setActiveTab} />

      <div className="main-area">
        <Header
          connected={sock.connected}
          running={sock.running}
          modelVersion={sock.modelVersion}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
        <Controls
          running={sock.running}
          cadence={sock.cadence}
          scenarios={sock.scenarios}
          onStart={sock.start}
          onPause={sock.pause}
          onCadence={sock.setCadence}
          onScenario={sock.runScenario}
        />
        <StatsBar stats={sock.stats} />
        <ExportPanel transactions={allTxns} incidents={incidents} />
        <AutoRefresh interval={refreshInterval} onChange={setRefreshInterval} lastRefreshed={lastRefreshed} />

        {activeTab === 'dashboard' && (
          <main className="layout">
            <section className="panel gauge-panel">
              <RiskGauge
                score={sock.latest?.score ?? allTxns[0]?.score ?? 0}
                tier={sock.latest?.tier ?? allTxns[0]?.tier ?? 'allow'}
                label={sock.latest ? `Latest · ${sock.latest.txn_id}` : 'Waiting for transactions'}
              />
              {sock.latest && (
                <>
                  <p className="action-line">
                    <b style={{ color: sock.latest.tier_color }}>{sock.latest.tier_label}</b>
                  </p>
                  <SignalBars
                    contributions={sock.latest.contributions}
                    ruleScore={sock.latest.rule_score}
                    mlScore={sock.latest.ml_score}
                  />
                </>
              )}
            </section>

            <section className="panel trend-panel">
              <MiniTrend transactions={allTxns} />
            </section>

            <section className="panel feed-panel">
              <TransactionFeed transactions={allTxns} onSelect={setSelectedId} selectedId={selectedId} />
            </section>

            <aside className="panel incidents-panel">
              <IncidentsPanel incidents={incidents} onSelect={setSelectedIncidentId} selectedId={selectedIncidentId} />
            </aside>
          </main>
        )}

        {activeTab === 'transactions' && (
          <section className="panel feed-panel full">
            <TransactionFeed transactions={allTxns} onSelect={setSelectedId} selectedId={selectedId} />
          </section>
        )}

        {activeTab === 'incidents' && (
          <section className="panel incidents-panel full">
            <IncidentsPanel incidents={incidents} onSelect={setSelectedIncidentId} selectedId={selectedIncidentId} />
          </section>
        )}

        {activeTab === 'analytics' && <Analytics transactions={allTxns} />}
      </div>

      {selected && (
        <DetailDrawer
          txn={selected}
          onClose={() => setSelectedId(null)}
          onFeedback={(id, wasFraud, notes) => sock.submitFeedback(id, wasFraud, notes)}
        />
      )}

      {selectedIncident && (
        <IncidentDrawer incident={selectedIncident} onClose={() => setSelectedIncidentId(null)} />
      )}
    </div>
  )
}