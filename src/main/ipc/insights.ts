import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { Insight } from '@shared/types'
import { runInsights } from '../insights/engine'

export function registerInsightsHandlers(db: Database.Database): void {
  ipcMain.handle('insights:get', (): Insight[] => runInsights(db, new Date()))
}
