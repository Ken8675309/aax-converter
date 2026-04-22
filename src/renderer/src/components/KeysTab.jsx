import { useState, useEffect, useCallback } from 'react'

export default function KeysTab() {
  const [keys, setKeys] = useState([])
  const [copied, setCopied] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newChecksum, setNewChecksum] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(async () => {
    setKeys(await window.api.keysList())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const copy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const del = async (id) => {
    await window.api.keysDelete(id)
    refresh()
  }

  const add = async (e) => {
    e.preventDefault()
    if (!/^[0-9a-fA-F]{8}$/.test(newKey)) {
      alert('Activation bytes must be exactly 8 hex characters (e.g. a1b2c3d4)')
      return
    }
    setAdding(true)
    try {
      await window.api.keysAdd({
        hexKey: newKey.toLowerCase(),
        checksum: newChecksum.toLowerCase() || undefined,
        bookTitle: newTitle || undefined,
        filePath: undefined
      })
      setNewKey(''); setNewChecksum(''); setNewTitle('')
      setShowAdd(false); refresh()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 680 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--ex-red2)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: "'Special Elite', cursive" }}>
            Sacred Activation Keys
          </div>
          <p style={{ fontSize: 10, color: 'var(--ex-muted)', marginTop: 2 }}>
            Keys are auto-extracted on first conversion and cached here.
          </p>
        </div>
        <button className="smol-btn" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Cancel' : '+ Inscribe manually'}
        </button>
      </div>

      {showAdd && (
        <div className="ex-panel">
          <div className="panel-label">Inscribe Key Manually</div>
          <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>
                Activation Bytes
              </div>
              <input
                type="text" required maxLength={8} value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="1a2b3c4d"
                className="ex-input mono" style={{ width: 130 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>
                Checksum (optional)
              </div>
              <input
                type="text" value={newChecksum}
                onChange={(e) => setNewChecksum(e.target.value)}
                placeholder="40-char hex"
                className="ex-input mono" style={{ width: 200 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>
                Book Title
              </div>
              <input
                type="text" value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Optional"
                className="ex-input" style={{ width: 160 }}
              />
            </div>
            <button type="submit" className="smol-btn" disabled={adding}>
              {adding ? 'Inscribing…' : 'Inscribe'}
            </button>
          </form>
        </div>
      )}

      <div className="ex-panel">
        <div className="panel-label">Sacred Activation Keys</div>

        {keys.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--ex-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No keys stored yet. Convert a .aax file and the key will appear here.
          </p>
        ) : (
          <>
            <div className="key-table-row" style={{ gridTemplateColumns: '90px 1fr 110px 60px', borderBottom: '1px solid rgba(61,46,0,0.6)' }}>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Key</span>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Book</span>
              <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Date</span>
              <span></span>
            </div>
            {keys.map((k) => (
              <div key={k.id} className="key-table-row" style={{ gridTemplateColumns: '90px 1fr 110px 60px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="hex">{k.activation_bytes}</span>
                  <button
                    className="smol-btn"
                    style={{ padding: '2px 5px', fontSize: 10 }}
                    onClick={() => copy(k.activation_bytes, k.id)}
                    title="Copy"
                  >
                    {copied === k.id ? '✓' : '⎘'}
                  </button>
                </div>
                <span style={{ color: 'var(--ex-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {k.book_title || k.label || '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--ex-muted)' }}>
                  {k.date_added ? new Date(k.date_added).toLocaleDateString() : '—'}
                </span>
                <button className="smol-btn danger" onClick={() => del(k.id)}>delete</button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="ex-verse">"Know thy key, know thy freedom."</div>
    </div>
  )
}
