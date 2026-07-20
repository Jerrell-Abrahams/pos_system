import { describe, expect, it } from 'vitest'
import {
  createTestDb,
  insertEmployee,
  insertProduct,
  insertSale,
  insertSaleItem,
  insertTill,
  toDbTimestamp
} from '../testUtils'
import { normalizeBarcodes } from './products'

describe('normalizeBarcodes', () => {
  it('trims each code and drops blanks', () => {
    expect(normalizeBarcodes(['  6001240012364 ', '', '   '])).toEqual(['6001240012364'])
  })

  it('removes duplicates within one product, keeping first order', () => {
    expect(normalizeBarcodes(['111', '222', '111'])).toEqual(['111', '222'])
  })

  it('returns an empty list when nothing usable is given', () => {
    expect(normalizeBarcodes([])).toEqual([])
    expect(normalizeBarcodes(['  '])).toEqual([])
  })
})

// Guards the guarantee products:delete leans on: an unused product deletes (cascading its
// barcodes), but FK RESTRICT blocks deleting one with sales history so records survive. If a
// future migration ever loosened sale_items to ON DELETE CASCADE, the second case would fail here.
describe('product hard-delete FK behaviour', () => {
  it('deletes an unused product and cascades its barcodes', () => {
    const db = createTestDb()
    const id = insertProduct(db)
    db.prepare('INSERT INTO product_barcodes (barcode, product_id) VALUES (?, ?)').run('123', id)

    db.prepare('DELETE FROM products WHERE id = ?').run(id)

    expect(db.prepare('SELECT id FROM products WHERE id = ?').get(id)).toBeUndefined()
    expect(db.prepare('SELECT barcode FROM product_barcodes WHERE product_id = ?').get(id)).toBeUndefined()
  })

  it('refuses to delete a product referenced by a sale', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db, 'manager')
    const tillId = insertTill(db, employeeId, toDbTimestamp(new Date()))
    const productId = insertProduct(db)
    const saleId = insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt: toDbTimestamp(new Date()) })
    insertSaleItem(db, { saleId, productId, productName: 'Test Product', qty: 1, unitPriceCents: 1000 })

    expect(() => db.prepare('DELETE FROM products WHERE id = ?').run(productId)).toThrow(
      /FOREIGN KEY constraint failed/
    )
  })
})
