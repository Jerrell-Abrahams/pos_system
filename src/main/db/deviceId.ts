import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'

export function ensureDeviceId(db: Database.Database): string {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'till_device_id'`).get() as
    | { value: string }
    | undefined
  if (row) return row.value

  const id = randomUUID()
  db.prepare(`INSERT INTO settings (key, value) VALUES ('till_device_id', ?)`).run(id)
  return id
}
