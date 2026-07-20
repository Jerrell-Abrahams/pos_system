import type Database from 'better-sqlite3'

export interface OpenTillInfo {
  id: number
  tillDeviceId: string
  openedAt: string
  openingCashCents: number
  expectedCashCents: number
}

export interface TillCloseResult {
  id: number
  expectedCashCents: number
  closingCashCents: number
  differenceCents: number
}

interface TillRow {
  id: number
  till_device_id: string
  opened_at: string
  opening_cash_cents: number
}

function cashSalesCents(db: Database.Database, tillId: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount_cents), 0) AS total
       FROM payments p JOIN sales s ON s.id = p.sale_id
       WHERE s.till_id = ? AND s.status = 'completed' AND p.method = 'cash'`
    )
    .get(tillId) as { total: number }
  return row.total
}

export function getOpenTill(db: Database.Database): OpenTillInfo | null {
  const row = db
    .prepare(`SELECT id, till_device_id, opened_at, opening_cash_cents FROM tills WHERE status = 'open'`)
    .get() as TillRow | undefined
  if (!row) return null
  return {
    id: row.id,
    tillDeviceId: row.till_device_id,
    openedAt: row.opened_at,
    openingCashCents: row.opening_cash_cents,
    expectedCashCents: row.opening_cash_cents + cashSalesCents(db, row.id)
  }
}

export function openTill(
  db: Database.Database,
  deviceId: string,
  employeeId: number,
  openingCashCents: number
): OpenTillInfo {
  if (getOpenTill(db)) throw new Error('A till is already open')
  const id = Number(
    db
      .prepare(
        `INSERT INTO tills (till_device_id, opened_by, opened_at, opening_cash_cents, status)
         VALUES (?, ?, datetime('now'), ?, 'open')`
      )
      .run(deviceId, employeeId, openingCashCents).lastInsertRowid
  )
  const row = db.prepare(`SELECT opened_at FROM tills WHERE id = ?`).get(id) as { opened_at: string }
  return {
    id,
    tillDeviceId: deviceId,
    openedAt: row.opened_at,
    openingCashCents,
    expectedCashCents: openingCashCents
  }
}

export function closeTill(db: Database.Database, employeeId: number, closingCashCents: number): TillCloseResult {
  const open = getOpenTill(db)
  if (!open) throw new Error('No open till')
  const differenceCents = closingCashCents - open.expectedCashCents
  db.prepare(
    `UPDATE tills
     SET closed_by = ?, closed_at = datetime('now'), closing_cash_cents = ?,
         expected_cash_cents = ?, cash_difference_cents = ?, status = 'closed'
     WHERE id = ?`
  ).run(employeeId, closingCashCents, open.expectedCashCents, differenceCents, open.id)
  return { id: open.id, expectedCashCents: open.expectedCashCents, closingCashCents, differenceCents }
}
