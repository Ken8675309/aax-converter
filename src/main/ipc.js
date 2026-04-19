import { dialog, app, safeStorage } from 'electron'
import path from 'path'
import { mkdirSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import * as db from '../db/queries.js'
import { detectFfmpeg, probeFile, convert, installFfmpegLinux } from './ffmpeg.js'
import {
  detectPython,
  checkAudibleLib,
  installAudibleCli,
  getAudibleConfigDir,
  startAuthProcess
} from './audible-activator.js'
import { buildFileTree } from './file-browser.js'

// ── Credential encryption ──────────────────────────────────────────────────
// safeStorage uses OS keychain (libsecret/Keychain/DPAPI) when available.

function encryptCredentials(creds) {
  const json = JSON.stringify(creds)
  if (safeStorage.isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(json)
    return JSON.stringify({ encrypted: true, data: buf.toString('base64') })
  }
  return JSON.stringify({ encrypted: false, data: json })
}

function decryptCredentials(stored) {
  try {
    const wrapper = JSON.parse(stored)
    if (wrapper.encrypted) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(wrapper.data, 'base64')))
    }
    return JSON.parse(wrapper.data)
  } catch {
    try { return JSON.parse(stored) } catch { return {} }
  }
}

// ── Ensure audible library ─────────────────────────────────────────────────

async function ensureAudibleLib(pythonCmd, onStatus) {
  if (checkAudibleLib(pythonCmd)) return
  onStatus?.('Installing audible-cli Python library…')
  await installAudibleCli(pythonCmd)
  if (!checkAudibleLib(pythonCmd)) {
    throw new Error('audible-cli install failed. Run: pip3 install audible-cli --break-system-packages')
  }
}

// ── Active sessions ────────────────────────────────────────────────────────

const activeConversions = new Map()
const authSessions = new Map()   // sessionId → { session, email, label }

export function setupIpc(ipcMain, getWindow) {
  // ── App info ──────────────────────────────────────────────────────────────

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    userData: app.getPath('userData'),
    encryptionAvailable: safeStorage.isEncryptionAvailable()
  }))

  // ── FFmpeg ────────────────────────────────────────────────────────────────

  ipcMain.handle('ffmpeg:detect', () => {
    const custom = db.getSetting('ffmpegPath')
    const found = detectFfmpeg(custom)
    return { path: found, found: !!found }
  })

  ipcMain.handle('ffmpeg:install', async () => {
    if (process.platform !== 'linux') throw new Error('Auto-install only supported on Linux')
    await installFfmpegLinux()
    return detectFfmpeg(null)
  })

  ipcMain.handle('ffmpeg:probe', async (_, filePath) => {
    const ffPath = detectFfmpeg(db.getSetting('ffmpegPath'))
    if (!ffPath) throw new Error('ffmpeg not found')
    return probeFile(ffPath, filePath)
  })

  // ── Convert ───────────────────────────────────────────────────────────────

  ipcMain.handle('convert:start', async (event, opts) => {
    const win = getWindow()
    const { inputPath, format = 'm4b', quality = '128k', outputFolder, accountId } = opts

    const ffPath = detectFfmpeg(db.getSetting('ffmpegPath'))
    if (!ffPath) throw new Error('ffmpeg not found. Please install ffmpeg first.')

    let activationBytes = null
    const account = accountId
      ? db.getAccounts().find((a) => a.id === accountId)
      : db.getActiveAccount()

    if (account) {
      const stored = db.findKey(account.id)
      if (stored) {
        activationBytes = stored.hex_key
      } else {
        const creds = decryptCredentials(account.credentials)
        const python = db.getSetting('pythonPath') || detectPython()
        if (!python) throw new Error('Python 3 not found')
        await ensureAudibleLib(python, (msg) => win?.webContents.send('convert:status', { msg }))

        activationBytes = await new Promise((resolve, reject) => {
          startAuthProcess({
            pythonPath: python,
            email: creds.email,
            password: creds.password,
            configDir: getAudibleConfigDir(),
            onEvent: (ev) => {
              if (ev.type === 'status') win?.webContents.send('convert:status', { msg: ev.message })
              if (ev.type === 'success') resolve(ev.activation_bytes)
              if (ev.type === 'error') reject(new Error(ev.message))
              if (ev.type === 'prompt') reject(new Error('Account requires re-authentication — please reconnect it in Settings'))
            }
          })
        })

        db.addKey({
          hexKey: activationBytes,
          bookTitle: path.basename(inputPath),
          accountId: account.id
        })
      }
    }

    const basename = path.basename(inputPath, '.aax')
    const outDir = outputFolder || path.join(path.dirname(inputPath), 'converted')
    mkdirSync(outDir, { recursive: true })
    const outputPath = path.join(outDir, `${basename}.${format}`)

    const convId = Date.now().toString()
    let killed = false

    const promise = convert({
      ffmpegPath: ffPath,
      inputPath,
      outputPath,
      format,
      quality,
      activationBytes,
      onProgress: (prog) => win?.webContents.send('convert:progress', { convId, ...prog })
    })

    activeConversions.set(convId, { kill: () => { killed = true } })

    try {
      await promise
      db.addHistory({
        inputPath,
        outputPath,
        filename: path.basename(inputPath),
        format,
        quality,
        accountId: account?.id
      })
      win?.webContents.send('convert:done', { convId, outputPath })
      return { convId, outputPath }
    } catch (err) {
      if (!killed) {
        db.addHistoryError({
          inputPath,
          filename: path.basename(inputPath),
          format,
          accountId: account?.id,
          error: err.message
        })
      }
      throw err
    } finally {
      activeConversions.delete(convId)
    }
  })

  ipcMain.handle('convert:cancel', (_, convId) => {
    const conv = activeConversions.get(convId)
    if (conv) { conv.kill(); activeConversions.delete(convId) }
  })

  // ── Auth (multi-step Audible login) ───────────────────────────────────────

  ipcMain.handle('auth:start', async (_, { email, password, label }) => {
    const win = getWindow()
    const python = db.getSetting('pythonPath') || detectPython()
    if (!python) throw new Error('Python 3 not found')

    await ensureAudibleLib(python, (msg) => {
      win?.webContents.send('auth:event', { sessionId: null, type: 'status', message: msg })
    })

    const sessionId = randomUUID()

    const session = startAuthProcess({
      pythonPath: python,
      email,
      password,
      configDir: getAudibleConfigDir(),
      onEvent: (ev) => {
        if (ev.type === 'success') {
          // Save account + key before forwarding success
          try {
            const encCreds = encryptCredentials({ email, password })
            db.addAccount({ email, label: label || email, credentials: encCreds })
            const account = db.getActiveAccount()
            db.addKey({ hexKey: ev.activation_bytes, label: label || email, accountId: account.id })
            win?.webContents.send('auth:event', {
              sessionId, ...ev, account
            })
          } catch (dbErr) {
            win?.webContents.send('auth:event', {
              sessionId, type: 'error', message: `Auth succeeded but saving failed: ${dbErr.message}`
            })
          }
          authSessions.delete(sessionId)
        } else {
          win?.webContents.send('auth:event', { sessionId, ...ev })
          if (ev.type === 'error') authSessions.delete(sessionId)
        }
      }
    })

    authSessions.set(sessionId, { session, email, label })
    return { sessionId }
  })

  ipcMain.handle('auth:respond', (_, { sessionId, code }) => {
    const entry = authSessions.get(sessionId)
    if (!entry) throw new Error('No active auth session')
    entry.session.respond(code)
  })

  ipcMain.handle('auth:cancel', (_, sessionId) => {
    const entry = authSessions.get(sessionId)
    if (entry) { entry.session.kill(); authSessions.delete(sessionId) }
  })

  // ── File browser ──────────────────────────────────────────────────────────

  ipcMain.handle('files:tree', (_, rootDir) => {
    if (!rootDir || !existsSync(rootDir)) return []
    return buildFileTree(rootDir)
  })

  ipcMain.handle('files:pick-folder', async () => {
    const result = await dialog.showOpenDialog(getWindow(), { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('files:pick-file', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      filters: [{ name: 'Audible AAX', extensions: ['aax'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('files:pick-output', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Output Folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Accounts ──────────────────────────────────────────────────────────────

  ipcMain.handle('accounts:list', () => db.getAccounts())
  ipcMain.handle('accounts:active', () => db.getActiveAccount())
  ipcMain.handle('accounts:switch', (_, id) => { db.switchAccount(id); return true })
  ipcMain.handle('accounts:remove', (_, id) => { db.removeAccount(id); return true })

  // ── Keys ──────────────────────────────────────────────────────────────────

  ipcMain.handle('keys:list', () => db.getKeys())
  ipcMain.handle('keys:add', (_, payload) => db.addKey(payload))
  ipcMain.handle('keys:delete', (_, id) => { db.deleteKey(id); return true })

  // ── History ───────────────────────────────────────────────────────────────

  ipcMain.handle('history:list', () => db.getHistory())

  // ── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get-all', () => db.getAllSettings())
  ipcMain.handle('settings:set', (_, key, value) => { db.setSetting(key, value); return true })

  ipcMain.handle('settings:detect-tools', () => {
    const py = detectPython()
    return {
      ffmpeg: detectFfmpeg(db.getSetting('ffmpegPath')),
      python: py,
      audibleLib: py ? checkAudibleLib(py) : false
    }
  })
}
