import { app, dialog } from 'electron'
import { appendLog } from './fileLog'

function logToFile(label: string, err: unknown): void {
  console.error(label, err)
  appendLog('crash.log', label, err)
}

export function installCrashHandlers(): void {
  process.on('uncaughtException', (err) => {
    logToFile('uncaughtException', err)
    dialog.showErrorBox(
      'Unexpected error',
      'The app hit an unexpected error and needs to close. Details were saved to crash.log.'
    )
    app.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logToFile('unhandledRejection', reason)
  })
}
