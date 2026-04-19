import { spawn, execSync } from 'child_process'
import path from 'path'
import { app } from 'electron'

export function detectPython() {
  for (const cmd of ['python3', 'python']) {
    try {
      const v = execSync(`${cmd} --version 2>&1`, { encoding: 'utf8' })
      if (v.includes('Python 3')) return cmd
    } catch { }
  }
  return null
}

export function checkAudibleLib(pythonCmd) {
  try {
    execSync(`${pythonCmd} -c "import audible"`, { encoding: 'utf8', stdio: 'pipe' })
    return true
  } catch { return false }
}

export function installAudibleCli(pythonCmd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [
      '-m', 'pip', 'install', 'audible-cli', '--break-system-packages', '--quiet'
    ])
    let err = ''
    proc.stderr.on('data', (d) => (err += d))
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`pip install failed: ${err.slice(-200)}`))
    )
    proc.on('error', reject)
  })
}

export function getAudibleConfigDir() {
  return path.join(app.getPath('userData'), 'audible')
}

// Python script communicates with us over JSON-newline on stdout.
// Credentials arrive via env vars — never in argv where they'd show in `ps`.
const AUTH_SCRIPT = String.raw`
import sys, json, os, pathlib

def write(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def read_response():
    line = sys.stdin.readline()
    if not line:
        raise EOFError("stdin closed unexpectedly")
    return json.loads(line.strip())

def cvf_callback(notification):
    write({"type": "prompt", "step": "cvf",
           "message": "Amazon sent a verification code to your email/phone"})
    return read_response().get("code", "")

def otp_callback(*args):
    write({"type": "prompt", "step": "otp",
           "message": "Enter the 6-digit code from your authenticator app"})
    return read_response().get("code", "")

try:
    import audible
except ImportError:
    write({"type": "error",
           "message": "audible library not found — run: pip3 install audible-cli --break-system-packages"})
    sys.exit(1)

email      = os.environ["AUDIBLE_EMAIL"]
password   = os.environ["AUDIBLE_PASSWORD"]
locale     = os.environ.get("AUDIBLE_LOCALE", "us")
config_dir = os.environ.get("AUDIBLE_CONFIG_DIR", "")

write({"type": "status", "message": "Connecting to Amazon…"})

try:
    auth = audible.Authenticator.from_login(
        email, password,
        locale=locale,
        with_username=False,
        cvf_callback=cvf_callback,
        otp_callback=otp_callback,
    )

    if config_dir:
        p = pathlib.Path(config_dir)
        p.mkdir(parents=True, exist_ok=True)
        auth.to_file(str(p / (email + ".json")))

    write({"type": "status", "message": "Fetching activation bytes…"})
    activation_bytes = auth.activation_bytes
    if not activation_bytes:
        write({"type": "error", "message": "Login succeeded but activation bytes unavailable"})
        sys.exit(1)

    write({"type": "success", "activation_bytes": str(activation_bytes).lower()})

except Exception as e:
    cls = type(e).__name__
    msg = str(e)
    if "LoginError" in cls or "AuthFlowError" in cls:
        msg = f"Login failed: {e}"
    write({"type": "error", "message": msg})
    sys.exit(1)
`.trim()

// Start an auth session. `onEvent` receives parsed JSON objects from the script.
// Returns { respond(code), kill() }.
export function startAuthProcess({ pythonPath, email, password, locale = 'us', configDir, onEvent }) {
  const python = pythonPath || detectPython()
  if (!python) throw new Error('Python 3 not found')

  const proc = spawn(python, ['-c', AUTH_SCRIPT], {
    env: {
      ...process.env,
      AUDIBLE_EMAIL: email,
      AUDIBLE_PASSWORD: password,
      AUDIBLE_LOCALE: locale,
      AUDIBLE_CONFIG_DIR: configDir || ''
    }
  })

  let buf = ''

  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString()
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        onEvent(JSON.parse(line))
      } catch { }
    }
  })

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim()
    if (text) onEvent({ type: 'status', message: text })
  })

  proc.on('error', (err) => {
    onEvent({ type: 'error', message: `Failed to start Python: ${err.message}` })
  })

  return {
    respond: (code) => proc.stdin.write(JSON.stringify({ code }) + '\n'),
    kill: () => { try { proc.kill('SIGTERM') } catch { } }
  }
}
