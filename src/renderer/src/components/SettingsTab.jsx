import { useState, useEffect, useCallback } from 'react'

export default function SettingsTab() {
  const [tools, setTools] = useState({})
  const [settings, setSettings] = useState({})
  const [saved, setSaved] = useState({})
  const [appInfo, setAppInfo] = useState(null)

  const refresh = useCallback(async () => {
    const [t, s, info] = await Promise.all([
      window.api.settingsDetectTools(),
      window.api.settingsGetAll(),
      window.api.getInfo()
    ])
    setTools(t); setSettings(s); setAppInfo(info)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const set = async (key, value) => {
    await window.api.settingsSet(key, value)
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 1500)
  }

  return (
    <div style={{ padding: 16, maxWidth: 620 }}>

      <div style={{ fontSize: 9, color: 'var(--ex-red2)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: "'Special Elite', cursive", marginBottom: 4 }}>
        Sacred Relics — Settings
      </div>

      {/* Defaults */}
      <div className="ex-panel">
        <div className="panel-label">Defaults</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Default Format</div>
            <select
              className="ex-select"
              value={settings.defaultFormat || 'm4b'}
              onChange={(e) => set('defaultFormat', e.target.value)}
            >
              {['m4b', 'mp3', 'm4a', 'flac', 'ogg', 'wav', 'opus', 'aac'].map((f) => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Default Quality</div>
            <select
              className="ex-select"
              value={settings.defaultQuality || '128k'}
              onChange={(e) => set('defaultQuality', e.target.value)}
            >
              <option value="copy">Copy / Lossless</option>
              <option value="128k">128 kbps</option>
              <option value="64k">64 kbps</option>
              <option value="32k">32 kbps</option>
            </select>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>
            Default Output Folder
            {saved.defaultOutputFolder && <span style={{ color: 'var(--ex-green2)', marginLeft: 8 }}>✓ Saved</span>}
          </div>
          <div className="output-row">
            <input
              type="text"
              value={settings.defaultOutputFolder || ''}
              onChange={(e) => set('defaultOutputFolder', e.target.value)}
              placeholder="Defaults to input_folder/converted/"
              className="ex-input"
              style={{ flex: 1 }}
            />
            <button
              className="smol-btn"
              onClick={async () => {
                const dir = await window.api.filesPickOutput()
                if (dir) set('defaultOutputFolder', dir)
              }}
            >
              browse
            </button>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="ex-panel">
        <div className="panel-label">Sacred Tools</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>ffmpeg</span>
            {tools.ffmpeg ? (
              <span style={{ fontSize: 10, color: 'var(--ex-green2)' }}>✓ {tools.ffmpeg}</span>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--ex-gold)' }}>Not detected</span>
            )}
            {saved.ffmpegPath && <span style={{ fontSize: 10, color: 'var(--ex-green2)' }}>✓ Saved</span>}
          </div>
          <input
            type="text"
            value={settings.ffmpegPath || ''}
            onChange={(e) => set('ffmpegPath', e.target.value)}
            onBlur={(e) => set('ffmpegPath', e.target.value)}
            placeholder="Override path (optional)"
            className="ex-input"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--ex-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>rcrack</span>
            {tools.rcrack ? (
              <span style={{ fontSize: 10, color: 'var(--ex-green2)' }}>✓ {tools.rcrack}</span>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--ex-red2)' }}>Not found in resources/tables/</span>
            )}
          </div>
          {tools.tablesDir && (
            <p style={{ fontSize: 10, color: 'var(--ex-muted)', fontFamily: 'monospace' }}>{tools.tablesDir}</p>
          )}
        </div>
        <button className="smol-btn" style={{ marginTop: 10 }} onClick={refresh}>
          Re-detect tools
        </button>
      </div>

      {/* About */}
      {appInfo && (
        <div className="ex-panel">
          <div className="panel-label">About The AAXorcist</div>
          <div className="tog-row">
            <span>Version</span>
            <span style={{ color: 'var(--ex-gold)', fontFamily: 'monospace' }}>v{appInfo.version}</span>
          </div>
          <div className="tog-row">
            <span>Platform</span>
            <span style={{ color: 'var(--ex-gold)' }}>{appInfo.platform}</span>
          </div>
          <div className="tog-row">
            <span>Data folder</span>
            <span style={{ color: 'var(--ex-muted)', fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
              {appInfo.userData}
            </span>
          </div>
        </div>
      )}

      <div className="ex-verse">"By the power of open source, I cast thee out."</div>
    </div>
  )
}
