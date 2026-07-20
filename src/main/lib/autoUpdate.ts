import { autoUpdater } from 'electron-updater'
import { appendLog } from './fileLog'

const LOG_FILE = 'update.log'
// A till can stay running for days between restarts -- without a periodic recheck, a newly
// published release would only ever be seen at the next app launch or a manual button click.
export const UPDATE_RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

// Registered once at module load (not inside checkForUpdates) -- that function runs on every
// startup AND every "Check for Update" click, and re-attaching listeners each time would stack
// duplicate handlers so a single event logs/fires once per past call.
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.on('checking-for-update', () => appendLog(LOG_FILE, 'checking-for-update'))
autoUpdater.on('update-available', (info) => appendLog(LOG_FILE, 'update-available', info.version))
autoUpdater.on('update-not-available', (info) => appendLog(LOG_FILE, 'update-not-available', info.version))
autoUpdater.on('download-progress', (p) => appendLog(LOG_FILE, 'download-progress', `${Math.round(p.percent)}%`))
autoUpdater.on('update-downloaded', (info) => appendLog(LOG_FILE, 'update-downloaded', info.version))
autoUpdater.on('error', (err) => appendLog(LOG_FILE, 'error', err))

// ponytail: autoUpdater already logs internally; we only need to swallow the
// "no internet" case so an offline till doesn't show an error dialog on launch.
export function checkForUpdates(): void {
  appendLog(LOG_FILE, 'checkForUpdatesAndNotify invoked')
  autoUpdater.checkForUpdatesAndNotify().catch((err) => appendLog(LOG_FILE, 'checkForUpdatesAndNotify rejected', err))
}
