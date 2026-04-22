import { useState } from 'react'

export default function FfmpegBanner({ onInstalled }) {
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState('')

  const install = async () => {
    setInstalling(true)
    setError('')
    try {
      await window.api.ffmpegInstall()
      onInstalled()
    } catch (err) {
      setError(err.message)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="ffmpeg-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--ex-gold)', fontSize: 14 }}>⚠</span>
        <span>
          ffmpeg not found —{' '}
          {process.platform === 'linux'
            ? 'Install it below, or run: sudo apt/dnf install ffmpeg'
            : 'Download ffmpeg and set the path in Relics.'}
        </span>
        {error && <span style={{ color: 'var(--ex-red2)', marginLeft: 8 }}>{error}</span>}
      </div>
      {process.platform === 'linux' && (
        <button className="smol-btn" onClick={install} disabled={installing}>
          {installing ? 'Invoking…' : '✝ Invoke ffmpeg'}
        </button>
      )}
    </div>
  )
}
