import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'

export function createDb(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'pos.db')
  return new Database(dbPath)
}
