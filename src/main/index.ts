import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { createDb } from './db'
import { runMigrations } from './db/migrate'
import { seed } from './db/seed'
import { registerIpcHandlers } from './ipc'
import { registerWindowHandlers } from './ipc/window'
import { initPrintQueue } from './lib/printQueue'
import { installCrashHandlers } from './lib/crashLog'
import { checkForUpdates, UPDATE_RECHECK_INTERVAL_MS } from './lib/autoUpdate'
import { startBackupSchedule } from './lib/backup'
import { checkStatus, LICENSE_RECHECK_INTERVAL_MS } from './lib/license'
import { syncDisplayProfiles, type ProfileTarget } from './lib/customerDisplay'
import type Database from 'better-sqlite3'
import type { LicenseState, PrintIssueEvent } from '@shared/types'

installCrashHandlers()

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function getPrinterInterface(db: Database.Database): string {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'printer_interface'`).get() as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

function getDisplayProfileTargets(db: Database.Database): ProfileTarget[] {
  const rows = db.prepare('SELECT id, enabled, display_slot FROM display_profiles').all() as {
    id: number
    enabled: number
    display_slot: number | null
  }[]
  return rows.map((r) => ({ id: r.id, enabled: r.enabled === 1, displaySlot: r.display_slot }))
}

app.whenReady().then(() => {
  const db = createDb()
  runMigrations(db)
  seed(db)
  registerIpcHandlers(db, () => syncDisplayProfiles(getDisplayProfileTargets(db)))
  registerWindowHandlers(() => mainWindow)
  startBackupSchedule(db)
  initPrintQueue(
    () => getPrinterInterface(db),
    (event: PrintIssueEvent) => mainWindow?.webContents.send('printer:issue', event)
  )

  const recheckLicense = (): void => {
    void checkStatus(db).then((state: LicenseState) => mainWindow?.webContents.send('license:state', state))
  }
  recheckLicense()
  setInterval(recheckLicense, LICENSE_RECHECK_INTERVAL_MS)

  mainWindow = createWindow()
  syncDisplayProfiles(getDisplayProfileTargets(db))
  checkForUpdates()
  setInterval(checkForUpdates, UPDATE_RECHECK_INTERVAL_MS)

  // Quitting must key off mainWindow specifically, not "all windows closed" — customer
  // displays can still be open on other monitors after the cashier closes the main POS window.
  mainWindow.on('closed', () => {
    mainWindow = null
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
})
