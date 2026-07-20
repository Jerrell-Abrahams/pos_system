import { ipcMain } from 'electron'
import { checkForUpdates } from '../lib/autoUpdate'

export function registerAutoUpdateHandlers(): void {
  ipcMain.handle('autoUpdate:check', (): void => checkForUpdates())
}
