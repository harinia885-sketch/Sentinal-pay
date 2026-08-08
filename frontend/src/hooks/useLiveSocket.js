import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_URL } from '../api'

export function useLiveSocket() {
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [cadence, setCadenceState] = useState(1.4)
  const [scenarios, setScenarios] = useState([])
  const [modelVersion, setModelVersion] = useState(null)
  const [latest, setLatest] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState(null)
  const wsRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let ws
    let retryTimer

    const connect = () => {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onmessage = (e) => {
        let msg
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }
        if (!mountedRef.current) return
        const data = msg.data
        switch (msg.type) {
          case 'status':
            if (typeof data.running === 'boolean') setRunning(data.running)
            if (typeof data.cadence === 'number') setCadenceState(data.cadence)
            if (Array.isArray(data.scenarios)) setScenarios(data.scenarios)
            if (data.stats) setStats(data.stats)
            if (typeof data.model_version === 'number') setModelVersion(data.model_version)
            break
          case 'transaction':
            setLatest(data)
            setTransactions((prev) => [data, ...prev].slice(0, 120))
            break
          case 'incident':
            setIncidents((prev) => [data, ...prev].slice(0, 60))
            break
          case 'stats':
            setStats(data)
            break
          default:
            break
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (mountedRef.current && !retryTimer) {
          retryTimer = setTimeout(connect, 2000)
        }
      }
      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(retryTimer)
      if (ws) ws.close()
    }
  }, [])

  const send = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const start = useCallback(() => send({ action: 'start' }), [send])
  const pause = useCallback(() => send({ action: 'pause' }), [send])
  const setCadence = useCallback(
    (value) => {
      setCadenceState(value)
      send({ action: 'set_cadence', value })
    },
    [send],
  )
  const runScenario = useCallback(
    (name) => send({ action: 'run_scenario', scenario: name }),
    [send],
  )
  const submitFeedback = useCallback(
    (txnId, wasFraudulent, notes) =>
      send({ action: 'feedback', txn_id: txnId, was_fraudulent: wasFraudulent, notes }),
    [send],
  )

  return {
    connected,
    running,
    cadence,
    scenarios,
    modelVersion,
    latest,
    transactions,
    incidents,
    stats,
    start,
    pause,
    setCadence,
    runScenario,
    submitFeedback,
  }
}