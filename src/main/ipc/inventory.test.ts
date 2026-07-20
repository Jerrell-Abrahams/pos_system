import { describe, expect, it } from 'vitest'
import { createTestDb, insertEmployee, insertProduct } from '../testUtils'
import { splitPack } from './inventory'

function makePack(
  db: ReturnType<typeof createTestDb>,
  opts: { packStock?: number; targetActive?: boolean; configureTarget?: boolean } = {}
): { packId: number; targetId: number; employeeId: number } {
  const { packStock = 10, targetActive = true, configureTarget = true } = opts
  const employeeId = insertEmployee(db, 'manager')
  const targetId = insertProduct(db, { name: 'Single', stockQty: 0, active: targetActive })
  const packId = insertProduct(db, { name: 'Six Pack', stockQty: packStock })
  db.prepare('UPDATE products SET is_6_pack = 1, split_target_product_id = ? WHERE id = ?').run(
    configureTarget ? targetId : null,
    packId
  )
  return { packId, targetId, employeeId }
}

const stockOf = (db: ReturnType<typeof createTestDb>, id: number): number =>
  (db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(id) as { stock_qty: number }).stock_qty

describe('splitPack', () => {
  it('moves 1 pack into 6 singles atomically and records both stock moves', () => {
    const db = createTestDb()
    const { packId, targetId, employeeId } = makePack(db, { packStock: 3 })

    const result = splitPack(db, { packProductId: packId, employeeId })

    expect(result).toEqual({ packProductId: packId, packStockQty: 2, targetProductId: targetId, targetStockQty: 6 })
    expect(stockOf(db, packId)).toBe(2)
    expect(stockOf(db, targetId)).toBe(6)
    const moves = db.prepare('SELECT product_id, type, qty FROM stock_moves ORDER BY id').all()
    expect(moves).toEqual([
      { product_id: packId, type: 'out', qty: -1 },
      { product_id: targetId, type: 'in', qty: 6 }
    ])
  })

  it('refuses to split when pack stock is below 1', () => {
    const db = createTestDb()
    const { packId, targetId, employeeId } = makePack(db, { packStock: 0 })
    expect(() => splitPack(db, { packProductId: packId, employeeId })).toThrow(/Not enough pack stock/)
    // Nothing partially applied — target stays at 0.
    expect(stockOf(db, targetId)).toBe(0)
  })

  it('rejects a product that is not a 6-pack', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db, 'manager')
    const plainId = insertProduct(db)
    expect(() => splitPack(db, { packProductId: plainId, employeeId })).toThrow(/not marked as a 6-pack/)
  })

  it('rejects a pack with no single product configured', () => {
    const db = createTestDb()
    const { packId, employeeId } = makePack(db, { configureTarget: false })
    expect(() => splitPack(db, { packProductId: packId, employeeId })).toThrow(/No single product is configured/)
  })

  it('rejects splitting into an inactive single product', () => {
    const db = createTestDb()
    const { packId, employeeId } = makePack(db, { targetActive: false })
    expect(() => splitPack(db, { packProductId: packId, employeeId })).toThrow(/inactive/)
  })
})
