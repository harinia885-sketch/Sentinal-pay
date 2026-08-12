const API = import.meta.env.VITE_API_URL || '/api'
export const WS_URL = `${API.replace(/^http/, 'ws')}/ws/live`

async function json(url, options) {
  const res = await fetch(`${API}${url}`, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const getTransactions = (limit = 50) => json(`/api/transactions?limit=${limit}`)
export const getIncidents = (limit = 50) => json(`/api/incidents?limit=${limit}`)
export const getStats = () => json('/api/stats')

export function sendFeedback(txnId, wasFraudulent, notes) {
  return json(`/api/transactions/${txnId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ was_fraudulent: wasFraudulent, notes }),
  })
}

export function retrainModel() {
  return json('/api/model/retrain', { method: 'POST' })
}
