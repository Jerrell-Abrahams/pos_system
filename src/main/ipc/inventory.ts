import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { StockAdjustInput, StockAdjustResult } from '@shared/types'
import { logAudit } from '../lib/auditLog'
import { insertOutbox } from '../lib/outbox'

export function registerInventoryHandlers(db: Database.Database): void {
  ipcMain.handle('inventory:adjustStock', (_event, input: StockAdjustInput): StockAdjustResult => {
    if (input.deltaQty === 0) throw new Error('Adjustment quantity cannot be zero')
    if (!input.reason.trim()) throw new Error('A reason is required for stock adjustments')

    const manager = db
      .prepare(`SELECT id FROM employees WHERE id = ? AND role = 'manager' AND active = 1`)
      .get(input.authorizedBy)
    if (!manager) throw new Error('Manager authorization required')

    const product = db.prepare('SELECT id, stock_qty FROM products WHERE id = ?').get(input.productId) as
      | { id: number; stock_qty: number }
      | undefined
    if (!product) throw new Error('Product not found')

    const deviceIdRow = db.prepare(`SELECT value FROM settings WHERE key = 'till_device_id'`).get() as
      | { value: string }
      | undefined
    const tillDeviceId = deviceIdRow?.value ?? ''
    const reason = input.reason.trim()

    const adjustStock = db.transaction((): StockAdjustResult => {
      db.prepare(`UPDATE products SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE id = ?`).run(
        input.deltaQty,
        input.productId
      )
      const moveId = Number(
        db
          .prepare(
            `INSERT INTO stock_moves (till_device_id, product_id, type, qty, reason, employee_id)
             VALUES (?, ?, 'adjustment', ?, ?, ?)`
          )
          .run(tillDeviceId, input.productId, input.deltaQty, reason, input.authorizedBy).lastInsertRowid
      )
      insertOutbox(db, 'stock_moves', moveId, 'insert', {
        id: moveId,
        till_device_id: tillDeviceId,
        product_id: input.productId,
        type: 'adjustment',
        qty: input.deltaQty,
        reason,
        employee_id: input.authorizedBy
      })
      insertOutbox(db, 'products', input.productId, 'update', {
        id: input.productId,
        stock_qty_delta: input.deltaQty
      })
      const newStockQty = product.stock_qty + input.deltaQty
      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'stock.adjust',
        entityType: 'product',
        entityId: input.productId,
        details: {
          changes: { stockQty: { before: product.stock_qty, after: newStockQty } },
          deltaQty: input.deltaQty,
          reason
        }
      })
      return { productId: input.productId, newStockQty }
    })

    return adjustStock()
  })
}
