import { useState, useEffect, useCallback } from 'react'

export default function HistoryTab() {
  const [history, setHistory] = useState([])

  const refresh = useCallback(async () => {
    setHistory(await window.api.historyList())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div style={{ padding: 16, maxWidth: 680 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: 'var(--ex-red2)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: "'Special Elite', cursive" }}>
          Book of the Dead
        </div>
        <button className="smol-btn" onClick={refresh}>Refresh</button>
      </div>

      <div className="ex-panel">
        <div className="panel-label">Book of the Dead</div>

        {history.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--ex-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No liberations recorded yet.
          </p>
        ) : (
          <>
            <div className="key-table-row" style={{ gridTemplateColumns: '1fr 70px 90px 60px', borderBottom: '1px solid rgba(61,46,0,0.6)' }}>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>File</span>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Format</span>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Date</span>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Status</span>
            </div>
            {history.map((h) => (
              <div key={h.id} className="key-table-row" style={{ gridTemplateColumns: '1fr 70px 90px 60px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--ex-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.filename}
                  </div>
                  {h.output_path && (
                    <div style={{ fontSize: 10, color: 'var(--ex-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.output_path}>
                      {h.output_path}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ex-gold)', textTransform: 'uppercase' }}>
                  {h.format}
                </span>
                <span style={{ fontSize: 10, color: 'var(--ex-muted)' }}>
                  {h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}
                </span>
                {h.status === 'success' ? (
                  <span style={{ fontSize: 10, color: 'var(--ex-green2)' }}>✓ Liberated</span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--ex-red2)' }} title={h.error}>✗ Failed</span>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="ex-verse">"Once liberated, never forgotten."</div>
    </div>
  )
}
