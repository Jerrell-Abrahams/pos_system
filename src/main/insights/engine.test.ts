import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { runInsights } from './engine'
import {
  closeTillAt,
  createTestDb,
  insertEmployee,
  insertProduct,
  insertSale,
  insertSaleItem,
  insertTill,
  toDbTimestamp
} from '../testUtils'

describe('runInsights', () => {
  it('sorts insights by severity: critical, then warning, then info', () => {
    const now = new Date(2026, 6, 13, 2, 15, 0) // early hour keeps peak-hour/stock insights quiet
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(now))
    closeTillAt(db, tillId, employeeId, 42000, 50000, toDbTimestamp(now)) // -R80 -> critical

    for (let i = 0; i < 5; i++) {
      insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt: toDbTimestamp(now), status: 'voided' })
    }

    // Stock kept high so today's 25 items don't also trip the stock-runout insight.
    const productId = insertProduct(db, { name: 'Castle Lager', stockQty: 100000 })
    for (let i = 0; i < 25; i++) {
      const saleId = insertSale(db, { tillId, employeeId, totalCents: 100, createdAt: toDbTimestamp(now) })
      insertSaleItem(db, { saleId, productId, productName: 'Castle Lager', qty: 1, unitPriceCents: 100 })
    }

    const insights = runInsights(db, now)
    expect(insights.map((i) => i.level)).toEqual(['critical', 'warning', 'info'])
    expect(insights.map((i) => i.id)).toEqual(['cash-variance', 'void-spike', 'revenue-concentration'])
  })

  it('never returns more than 6 insights', () => {
    const now = new Date(2026, 6, 13, 2, 15, 0)
    const db = createTestDb()
    expect(runInsights(db, now).length).toBeLessThanOrEqual(6)
  })

  it('completes within 200ms against 10,000 sales / 50,000 sale items', () => {
    const now = new Date(2026, 6, 13, 20, 0, 0)
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(now))
    const productIds = Array.from({ length: 20 }, (_, i) => insertProduct(db, { name: `Product ${i}`, stockQty: 500 }))

    const insertSaleStmt = db.prepare(
      `INSERT INTO sales (receipt_no, till_id, till_device_id, employee_id, subtotal_cents, total_cents, status, created_at)
       VALUES (?, ?, 'test-device', ?, ?, ?, 'completed', ?)`
    )
    const insertItemStmt = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price_cents, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?)`
    )

    const seed = db.transaction(() => {
      for (let s = 0; s < 10_000; s++) {
        const daysAgo = s % 14
        const hour = s % 24
        const createdAt = toDbTimestamp(
          new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, s % 60, 0)
        )
        const total = 500 * 5
        const saleId = Number(
          insertSaleStmt.run(`R-PERF-${s}`, tillId, employeeId, total, total, createdAt).lastInsertRowid
        )
        for (let itemIndex = 0; itemIndex < 5; itemIndex++) {
          const productId = productIds[(s + itemIndex) % productIds.length]
          insertItemStmt.run(saleId, productId, 'Product', 1, 500, 500)
        }
      }
    })
    seed()

    const start = performance.now()
    runInsights(db, now)
    const durationMs = performance.now() - start

    expect(durationMs).toBeLessThan(200)
  })
})
