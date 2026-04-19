import { useState, useEffect, useRef, useCallback } from 'react'

const STEPS = { credentials: 'credentials', cvf: 'cvf', otp: 'otp', success: 'success' }

export default function AddAccountModal({ onClose, onAdded }) {
  // Step 1 — credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pastEmails, setPastEmails] = useState([])

  // Multi-step state
  const [step, setStep] = useState(STEPS.credentials)
  const [sessionId, setSessionId] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 2/3 — verification code
  const [code, setCode] = useState('')
  const [codePromptMsg, setCodePromptMsg] = useState('')
  const codeInputRef = useRef(null)

  // Load past emails for datalist
  useEffect(() => {
    window.api.accountsList().then((list) => {
      setPastEmails(list.map((a) => a.email).filter(Boolean))
    })
  }, [])

  // Auto-populate label from email username
  const handleEmailChange = (val) => {
    setEmail(val)
    if (!label || pastEmails.some((e) => val.startsWith(e.split('@')[0]))) {
      const username = val.split('@')[0]
      if (username) setLabel(username)
    }
  }

  // Listen to auth events from main process
  useEffect(() => {
    const off = window.api.onAuthEvent((ev) => {
      if (ev.sessionId && ev.sessionId !== sessionId) return

      if (ev.type === 'status') {
        setStatusMsg(ev.message)
      } else if (ev.type === 'prompt') {
        setStatusMsg('')
        setCode('')
        setCodePromptMsg(ev.message)
        setStep(ev.step === 'otp' ? STEPS.otp : STEPS.cvf)
        setLoading(false)
        setTimeout(() => codeInputRef.current?.focus(), 50)
      } else if (ev.type === 'success') {
        setStep(STEPS.success)
        setLoading(false)
        setTimeout(() => { onAdded() }, 2000)
      } else if (ev.type === 'error') {
        setError(ev.message)
        setStep(STEPS.credentials)
        setLoading(false)
      }
    })
    return off
  }, [sessionId, onAdded])

  // Cancel session on unmount
  useEffect(() => {
    return () => {
      if (sessionId) window.api.authCancel(sessionId).catch(() => { })
    }
  }, [sessionId])

  const handleConnect = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMsg('Starting…')
    setLoading(true)
    try {
      const result = await window.api.authStart({ email, password, label: label || email })
      setSessionId(result.sessionId)
      // Events will drive the rest from here
    } catch (err) {
      setError(err.message)
      setStatusMsg('')
      setLoading(false)
    }
  }

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setStatusMsg('Verifying…')
    try {
      await window.api.authRespond(sessionId, code.trim())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const resetToCredentials = () => {
    if (sessionId) window.api.authCancel(sessionId).catch(() => { })
    setSessionId(null)
    setStep(STEPS.credentials)
    setError('')
    setStatusMsg('')
    setCode('')
    setLoading(false)
  }

  const handleClose = () => {
    if (sessionId) window.api.authCancel(sessionId).catch(() => { })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={step !== STEPS.success ? handleClose : undefined}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Step 1: Credentials ── */}
        {step === STEPS.credentials && (
          <>
            <h2 className="text-lg font-semibold mb-4">Connect Audible Account</h2>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input
                  list="email-history"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="you@amazon.com"
                />
                <datalist id="email-history">
                  {pastEmails.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Label <span className="text-slate-600">(optional)</span></label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="e.g. My Audible account"
                />
              </div>

              {statusMsg && (
                <p className="text-xs text-slate-400 bg-slate-900 rounded p-2 font-mono">{statusMsg}</p>
              )}
              {error && (
                <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded p-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded text-sm bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Spinner />}
                  {loading ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 2: CVF / Step 3: OTP ── */}
        {(step === STEPS.cvf || step === STEPS.otp) && (
          <>
            <h2 className="text-lg font-semibold mb-1">
              {step === STEPS.cvf ? 'Verification Code' : 'Two-Factor Authentication'}
            </h2>
            <p className="text-sm text-slate-400 mb-4">{codePromptMsg}</p>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  {step === STEPS.cvf ? 'CVF Code' : 'OTP Code'}
                </label>
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-brand-500"
                  placeholder="000000"
                />
              </div>

              {statusMsg && (
                <p className="text-xs text-slate-400 bg-slate-900 rounded p-2 font-mono">{statusMsg}</p>
              )}
              {error && (
                <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded p-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={resetToCredentials}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length < 4}
                  className="px-4 py-2 rounded text-sm bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Spinner />}
                  {loading ? 'Verifying…' : 'Submit Code'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 4: Success ── */}
        {step === STEPS.success && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-green-400 mb-1">Account Connected</h2>
            <p className="text-sm text-slate-400">Activation bytes retrieved and stored.</p>
            <p className="text-xs text-slate-600 mt-3">Closing…</p>
          </div>
        )}
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
