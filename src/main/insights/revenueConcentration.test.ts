import { describe, expect, it } from 'vitest'
import { revenueConcentrationInsight } from './revenueConcentration'
import {
  createTestDb,
  insertEmployee,
  insertProduct,
  insertSale,
  insertSaleItem,
  insertTill,
  toDbTimestamp
} from '../testUtils'

const NOW = new Date(2026, 6, 13, 15, 0, 0)

describe('revenueConcentrationInsight', () => {
  it('reports the top-five revenue share once today has 20+ sale items', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const createdAt = toDbTimestamp(NOW)

    // 5 "top" products at R1.80 revenue each (R9 total) + a 6th product at R1 -> top5 share = 90%
    for (let p = 0; p < 5; p++) {
      const productId = insertProduct(db, { name: `Top Product ${p}` })
      for (let i = 0; i < 4; i++) {
        const saleId = insertSale(db, { tillId, employeeId, totalCents: 45, createdAt })
        insertSaleItem(db, { saleId, productId, productName: `Top Product ${p}`, qty: 1, unitPriceCents: 45 })
      }
    }
    const otherProduct = insertProduct(db, { name: 'Other Product' })
    for (let i = 0; i < 5; i++) {
      const saleId = insertSale(db, { tillId, employeeId, totalCents: 20, createdAt })
      insertSaleItem(db, { saleId, productId: otherProduct, productName: 'Other Product', qty: 1, unitPriceCents: 20 })
    }

    const insight = revenueConcentrationInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('info')
    expect(insight?.message).toBe("Your top five products generated **90%** of today's revenue.")
    expect(insight?.navigateTo).toEqual({ screen: 'analytics', params: { report: 'bestSelling' } })
  })

  it('suppresses the insight when today has fewer than 20 sale items', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const productId = insertProduct(db, { name: 'Castle Lager' })
    const createdAt = toDbTimestamp(NOW)

    for (let i = 0; i < 10; i++) {
      const saleId = insertSale(db, { tillId, employeeId, totalCents: 100, createdAt })
      insertSaleItem(db, { saleId, productId, productName: 'Castle Lager', qty: 1, unitPriceCents: 100 })
    }

    expect(revenueConcentrationInsight(db, NOW)).toBeNull()
  })
})
