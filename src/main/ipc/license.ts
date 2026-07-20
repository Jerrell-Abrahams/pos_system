import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { activate, checkStatus, deactivate } from '../lib/license'
import type { LicenseActivateInput, LicenseState } from '@shared/types'

export function registerLicenseHandlers(db: Database.Database): void {
  ipcMain.handle('license:getState', (): Promise<LicenseState> => checkStatus(db))

  ipcMain.handle(
    'license:activate',
    (_event, input: LicenseActivateInput): Promise<LicenseState> =>
      activate(db, input.email, input.password, input.deviceName)
  )

  ipcMain.handle('license:recheck', (): Promise<LicenseState> => checkStatus(db))

  ipcMain.handle('license:deactivate', (): void => deactivate(db))
}
