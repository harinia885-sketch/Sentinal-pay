function toCSV(rows, columns) {
  const header = columns.map((c) => c.label).join(',')
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        let v = c.get(r)
        if (v == null) v = ''
        v = String(v).replace(/"/g, '""')
        return /[",\n]/.test(v) ? `"${v}"` : v
      })
      .join(',')
  )
  return [header, ...lines].join('\n')
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const TXN_COLUMNS = [
  { label: 'Time', get: (t) => t.created_at },
  { label: 'Txn ID', get: (t) => t.txn_id },
  { label: 'Payer', get: (t) => t.signals?.payer },
  { label: 'Beneficiary', get: (t) => t.signals?.beneficiary },
  { label: 'Amount', get: (t) => t.signals?.amount },
  { label: 'Score', get: (t) => t.score?.toFixed?.(1) },
  { label: 'Tier', get: (t) => t.tier },
  { label: 'Scenario', get: (t) => t.scenario },
]

const INCIDENT_COLUMNS = [
  { label: 'Time', get: (i) => i.created_at },
  { label: 'Alert ID', get: (i) => i.id },
  { label: 'Payer', get: (i) => i.payer },
  { label: 'Beneficiary', get: (i) => i.beneficiary },
  { label: 'Amount', get: (i) => i.amount },
  { label: 'Score', get: (i) => i.score?.toFixed?.(1) },
  { label: 'Channel', get: (i) => i.channel },
]

export default function ExportPanel({ transactions, incidents }) {
  const exportTxns = () => {
    const csv = toCSV(transactions, TXN_COLUMNS)
    download(`sentinelpay_transactions_${Date.now()}.csv`, csv)
  }
  const exportIncidents = () => {
    const csv = toCSV(incidents, INCIDENT_COLUMNS)
    download(`sentinelpay_incidents_${Date.now()}.csv`, csv)
  }

  return (
    <div className="export-panel">
      <button className="btn-ghost" onClick={exportTxns} disabled={!transactions.length}>
        ⬇ Export transactions ({transactions.length})
      </button>
      <button className="btn-ghost" onClick={exportIncidents} disabled={!incidents.length}>
        ⬇ Export incidents ({incidents.length})
      </button>
    </div>
  )
}