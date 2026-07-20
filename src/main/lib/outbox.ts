import type Database from 'better-sqlite3'

export type OutboxOperation = 'insert' | 'update' | 'delete'

export function insertOutbox(
  db: Database.Database,
  tableName: string,
  rowId: number,
  operation: OutboxOperation,
  payload: unknown
): void {
  db.prepare(
    `INSERT INTO sync_queue (table_name, row_id, operation, payload) VALUES (?, ?, ?, ?)`
  ).run(tableName, rowId, operation, JSON.stringify(payload))
}
