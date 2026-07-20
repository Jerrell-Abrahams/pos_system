import { autoUpdater } from 'electron-updater'

// ponytail: autoUpdater already logs internally; we only need to swallow the
// "no internet" case so an offline till doesn't show an error dialog on launch.
export function checkForUpdates(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', (err) => {
    console.error('[autoUpdate]', err.message)
  })
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[autoUpdate]', err.message)
  })
}
