import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { SplitPackInput, SplitPackResult, StockAdjustInput, StockAdjustResult } from '@shared/types'
import { logAudit } from '../lib/auditLog'
import { insertOutbox } from '../lib/outbox'
import { requireRealEmployee } from '../lib/superUser'

// Breaks open one 6-pack into 6 single units: pack stock -1, target single stock +6, atomically.
// Exported (not just inlined in the handler) so the stock/audit bookkeeping has a unit test.
export function splitPack(db: Database.Database, input: SplitPackInput): SplitPackResult {
  requireRealEmployee(input.employeeId)

  const pack = db
    .prepare('SELECT id, name, is_6_pack, split_target_product_id FROM products WHERE id = ?')
    .get(input.packProductId) as
    | { id: number; name: string; is_6_pack: number; split_target_product_id: number | null }
    | undefined
  if (!pack) throw new Error('Product not found')
  if (pack.is_6_pack !== 1) throw new Error('This product is not marked as a 6-pack')
  if (pack.split_target_product_id == null) throw new Error('No single product is configured for this pack')

  const target = db
    .prepare('SELECT id, name, active FROM products WHERE id = ?')
    .get(pack.split_target_product_id) as { id: number; name: string; active: number } | undefined
  if (!target) throw new Error('The configured single product no longer exists')
  if (target.active !== 1) throw new Error('The configured single product is inactive')

  const deviceIdRow = db.prepare(`SELECT value FROM settings WHERE key = 'till_device_id'`).get() as
    | { value: string }
    | undefined
  const tillDeviceId = deviceIdRow?.value ?? ''
  const packReason = `Split into 6 × ${target.name}`
  const targetReason = `Split from ${pack.name}`

  const run = db.transaction((): SplitPackResult => {
    // Re-read pack stock inside the transaction and guard >= 1 so a rapid double-tap can't split
    // the same last pack twice — the second attempt finds it already at 0. Same reason sales never
    // let stock silently underflow.
    const packStock = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(pack.id) as { stock_qty: number }
    if (packStock.stock_qty < 1) throw new Error('Not enough pack stock to split')

    db.prepare(`UPDATE products SET stock_qty = stock_qty - 1, updated_at = datetime('now') WHERE id = ?`).run(pack.id)
    db.prepare(`UPDATE products SET stock_qty = stock_qty + 6, updated_at = datetime('now') WHERE id = ?`).run(target.id)

    const insertMove = db.prepare(
      `INSERT INTO stock_moves (till_device_id, product_id, type, qty, reason, employee_id) VALUES (?, ?, ?, ?, ?, ?)`
    )
    const packMoveId = Number(insertMove.run(tillDeviceId, pack.id, 'out', -1, packReason, input.employeeId).lastInsertRowid)
    insertOutbox(db, 'stock_moves', packMoveId, 'insert', {
      id: packMoveId,
      till_device_id: tillDeviceId,
      product_id: pack.id,
      type: 'out',
      qty: -1,
      reason: packReason,
      employee_id: input.employeeId
    })
    const targetMoveId = Number(insertMove.run(tillDeviceId, target.id, 'in', 6, targetReason, input.employeeId).lastInsertRowid)
    insertOutbox(db, 'stock_moves', targetMoveId, 'insert', {
      id: targetMoveId,
      till_device_id: tillDeviceId,
      product_id: target.id,
      type: 'in',
      qty: 6,
      reason: targetReason,
      employee_id: input.employeeId
    })

    insertOutbox(db, 'products', pack.id, 'update', { id: pack.id, stock_qty_delta: -1 })
    insertOutbox(db, 'products', target.id, 'update', { id: target.id, stock_qty_delta: 6 })

    const packStockQty = packStock.stock_qty - 1
    const targetStockQty = (db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(target.id) as {
      stock_qty: number
    }).stock_qty

    logAudit(db, {
      employeeId: input.employeeId,
      action: 'stock.splitPack',
      entityType: 'product',
      entityId: pack.id,
      details: { targetProductId: target.id, packStockQty, targetStockQty }
    })

    return { packProductId: pack.id, packStockQty, targetProductId: target.id, targetStockQty }
  })

  return run()
}

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

  ipcMain.handle('inventory:splitPack', (_event, input: SplitPackInput): SplitPackResult => splitPack(db, input))
}
