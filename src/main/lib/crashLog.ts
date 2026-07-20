import { app, dialog } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'

function logToFile(label: string, err: unknown): void {
  const stack = err instanceof Error ? err.stack : String(err)
  const line = `[${new Date().toISOString()}] ${label}\n${stack}\n\n`
  console.error(line)
  try {
    appendFileSync(join(app.getPath('userData'), 'crash.log'), line)
  } catch {
    // logging is best-effort; don't let a failed write mask the original crash
  }
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
