import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { TestActionResult } from '@shared/types'
import * as printer from '../lib/printer'

function getPrinterInterface(db: Database.Database): string {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'printer_interface'`).get() as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

export function registerPrinterHandlers(db: Database.Database): void {
  ipcMain.handle('printer:testPrint', async (): Promise<TestActionResult> => {
    try {
      await printer.testPrint(getPrinterInterface(db))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Test print failed' }
    }
  })

  ipcMain.handle('printer:testDrawerKick', async (): Promise<TestActionResult> => {
    try {
      await printer.testDrawerKick(getPrinterInterface(db))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Drawer kick failed' }
    }
  })
}
