import { useState } from 'react'
import { sendFeedback, retrainModel } from '../api'

function money(n) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export default function DetailDrawer({ txn, onClose, onFeedback }) {
  const [feedback, setFeedback] = useState(null)
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)
  const [retrainMsg, setRetrainMsg] = useState(null)

  if (!txn) return null
  const signals = txn.signals || {}

  const submit = async (wasFraudulent) => {
    setSending(true)
    try {
      await sendFeedback(txn.txn_id, wasFraudulent, notes)
      setFeedback(wasFraudulent ? 'reported-fraud' : 'reported-legit')
      onFeedback?.(txn.txn_id, wasFraudulent, notes)
    } finally {
      setSending(false)
    }
  }

  const retrain = async () => {
    setRetrainMsg('Retraining…')
    try {
      const r = await retrainModel()
      setRetrainMsg(`Model v${r.version} · AUC ${r.roc_auc} · ${r.train_samples} samples`)
    } catch {
      setRetrainMsg('Retrain failed')
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h2>Transaction {txn.txn_id}</h2>
            <span className="muted">{fmtTime(txn.created_at)}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-score" style={{ borderColor: txn.tier_color }}>
          <span className="drawer-score-num" style={{ color: txn.tier_color }}>{txn.score.toFixed(1)}</span>
          <span className={`tag tag-${txn.tier}`} style={{ background: `${txn.tier_color}1f`, color: txn.tier_color }}>{txn.tier}</span>
          <span className="drawer-score-label">{txn.tier_label}</span>
        </div>

        <div className="drawer-grid">
          <div className="kv"><span>Payer</span><b>{signals.payer || '—'}</b></div>
          <div className="kv"><span>Beneficiary</span><b>{signals.beneficiary || '—'}</b></div>
          <div className="kv"><span>UPI ID</span><b>{signals.beneficiary_id || '—'}</b></div>
          <div className="kv"><span>Amount</span><b>{money(signals.amount)}</b></div>
          <div className="kv"><span>Call active</span><b>{signals.call_active ? 'Yes' : 'No'}</b></div>
          <div className="kv"><span>Screen-share</span><b>{signals.screen_share_active ? 'Yes' : 'No'}</b></div>
          <div className="kv"><span>Beneficiary age</span><b>{Math.round(signals.beneficiary_age_days || 0)} days</b></div>
          <div className="kv"><span>Voice-clone prob.</span><b>{(signals.voice_anomaly_score || 0) * 100}%</b></div>
        </div>

        <p className="explanation">{txn.explanation}</p>

        <div>
          <h3>Why this score</h3>
          {(txn.contributions || []).length === 0 && <p className="muted small">No rule signals fired.</p>}
          {(txn.contributions || []).map((c) => (
            <div className="contrib" key={`${c.signal}-${c.points}`}>
              <div className="contrib-head">
                <span>{c.label}</span>
                <b style={{ color: c.points > 10 ? '#dc2626' : '#ca8a04' }}>+{c.points}</b>
              </div>
              <p>{c.reason}</p>
            </div>
          ))}
        </div>

        <div className="ml-line">
          <span>ML (behavioural model)</span>
          <span className="muted">P(fraud) {((txn.ml_score || 0) / 100).toFixed(2)} · confidence {txn.ml_confidence}</span>
        </div>

        <button className="ghost-btn" onClick={() => setShowEvidence((s) => !s)}>
          {showEvidence ? 'Hide evidence bundle' : 'View evidence bundle (for bank API)'}
        </button>
        {showEvidence && (
          <pre className="evidence">{JSON.stringify(txn.evidence, null, 2)}</pre>
        )}

        <div className="feedback">
          <h3>Feedback loop</h3>
          {feedback === null ? (
            <>
              <input
                className="notes-input"
                placeholder="Optional note (e.g. real family emergency, false positive)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="feedback-btns">
                <button className="btn-danger" disabled={sending} onClick={() => submit(true)}>
                  Report as fraud
                </button>
                <button className="btn-good" disabled={sending} onClick={() => submit(false)}>
                  Legitimate / false positive
                </button>
              </div>
              <p className="muted small">Feedback is fed back into model retraining to reduce false positives.</p>
            </>
          ) : (
            <p className="muted">
              {feedback === 'reported-fraud' ? 'Reported as fraud — thank you.' : 'Marked legitimate — this becomes a false-positive example for the next retrain.'}
            </p>
          )}
        </div>

        <button className="ghost-btn" onClick={retrain}>
          Retrain model with feedback
        </button>
        {retrainMsg && <p className="muted small">{retrainMsg}</p>}
      </div>
    </>
  )
}