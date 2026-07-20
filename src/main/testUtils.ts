import Database from 'better-sqlite3'
import { runMigrations } from './db/migrate'

export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

// SQLite's datetime('now') stores UTC with no offset. Given a Date representing a specific
// local instant, this renders the same instant's UTC calendar fields — the same string the
// real app would have written had that instant been "now" — so date(x,'localtime') queries
// resolve it back to the intended local day/time regardless of the test runner's timezone.
export function toDbTimestamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export function insertEmployee(db: Database.Database, role: 'manager' | 'cashier' = 'cashier'): number {
  return Number(
    db.prepare(`INSERT INTO employees (name, pin_hash, role) VALUES ('Test Employee', 'x', ?)`).run(role)
      .lastInsertRowid
  )
}

export function insertProduct(
  db: Database.Database,
  overrides: Partial<{ name: string; sellPriceCents: number; stockQty: number; active: boolean }> = {}
): number {
  const { name = 'Test Product', sellPriceCents = 1000, stockQty = 100, active = true } = overrides
  return Number(
    db
      .prepare(
        `INSERT INTO products (name, sell_price_cents, cost_price_cents, stock_qty, active)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(name, sellPriceCents, Math.floor(sellPriceCents / 2), stockQty, active ? 1 : 0).lastInsertRowid
  )
}

export function insertTill(db: Database.Database, employeeId: number, openedAt: string): number {
  return Number(
    db
      .prepare(
        `INSERT INTO tills (till_device_id, opened_by, opened_at, opening_cash_cents, status)
         VALUES ('test-device', ?, ?, 0, 'open')`
      )
      .run(employeeId, openedAt).lastInsertRowid
  )
}

export function closeTillAt(
  db: Database.Database,
  tillId: number,
  employeeId: number,
  closingCashCents: number,
  expectedCashCents: number,
  closedAt: string
): void {
  const differenceCents = closingCashCents - expectedCashCents
  db.prepare(
    `UPDATE tills
     SET closed_by = ?, closed_at = ?, closing_cash_cents = ?, expected_cash_cents = ?,
         cash_difference_cents = ?, status = 'closed'
     WHERE id = ?`
  ).run(employeeId, closedAt, closingCashCents, expectedCashCents, differenceCents, tillId)
}

let receiptCounter = 0

export function insertSale(
  db: Database.Database,
  params: {
    tillId: number
    employeeId: number
    totalCents: number
    createdAt: string
    status?: 'completed' | 'voided' | 'refunded'
  }
): number {
  const { tillId, employeeId, totalCents, createdAt, status = 'completed' } = params
  receiptCounter += 1
  return Number(
    db
      .prepare(
        `INSERT INTO sales (receipt_no, till_id, till_device_id, employee_id, subtotal_cents, total_cents, status, created_at)
         VALUES (?, ?, 'test-device', ?, ?, ?, ?, ?)`
      )
      .run(`R-TEST-${receiptCounter}`, tillId, employeeId, totalCents, totalCents, status, createdAt).lastInsertRowid
  )
}

export function insertSaleItem(
  db: Database.Database,
  params: { saleId: number; productId: number; productName: string; qty: number; unitPriceCents: number }
): void {
  const { saleId, productId, productName, qty, unitPriceCents } = params
  db.prepare(
    `INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price_cents, line_total_cents)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(saleId, productId, productName, qty, unitPriceCents, Math.round(qty * unitPriceCents))
}
