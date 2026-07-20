import { app } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'

// Shared by crashLog.ts and autoUpdate.ts -- best-effort so a failed write never masks
// the original event.
export function appendLog(fileName: string, label: string, detail?: unknown): void {
  const body =
    detail instanceof Error ? detail.stack : detail === undefined || detail === '' ? '' : String(detail)
  const line = `[${new Date().toISOString()}] ${label}${body ? '\n' + body : ''}\n`
  try {
    appendFileSync(join(app.getPath('userData'), fileName), line)
  } catch {
    // best-effort
  }
}
