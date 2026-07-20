import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { addDays, formatLocalDate } from '@shared/dates'
import { stockRunoutInsight } from './stockRunout'
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

function sellOnDay(
  db: Database.Database,
  tillId: number,
  employeeId: number,
  daysAgo: number,
  productId: number,
  productName: string,
  qty: number
): void {
  const createdAt = toDbTimestamp(addDays(NOW, -daysAgo))
  const saleId = insertSale(db, { tillId, employeeId, totalCents: qty * 1000, createdAt })
  insertSaleItem(db, { saleId, productId, productName, qty, unitPriceCents: 1000 })
}

describe('stockRunoutInsight', () => {
  it('reports critical when a product will run out in 2 days', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const productId = insertProduct(db, { name: 'Castle Lager', stockQty: 20 })

    // 10 units/day average over 2 active days, 20 in stock -> 2 days remaining
    sellOnDay(db, tillId, employeeId, 0, productId, 'Castle Lager', 10)
    sellOnDay(db, tillId, employeeId, 1, productId, 'Castle Lager', 10)

    const insight = stockRunoutInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('critical')
    expect(insight?.message).toBe('**Castle Lager** will likely run out in **2 days**.')
    expect(insight?.navigateTo).toEqual({ screen: 'inventory', params: { productId } })
  })

  it('reports warning when a product will run out in 4 days', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const productId = insertProduct(db, { name: 'Castle Lager', stockQty: 20 })

    // 5 units/day average over 2 active days, 20 in stock -> 4 days remaining
    sellOnDay(db, tillId, employeeId, 0, productId, 'Castle Lager', 5)
    sellOnDay(db, tillId, employeeId, 1, productId, 'Castle Lager', 5)

    const insight = stockRunoutInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('warning')
    expect(insight?.message).toBe('**Castle Lager** will likely run out in **4 days**.')
  })

  it('shows a summary card when 2+ products are close to running out', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const productA = insertProduct(db, { name: 'Castle Lager', stockQty: 20 })
    const productB = insertProduct(db, { name: 'Hansa Pilsener', stockQty: 20 })

    sellOnDay(db, tillId, employeeId, 0, productA, 'Castle Lager', 10)
    sellOnDay(db, tillId, employeeId, 1, productA, 'Castle Lager', 10)
    sellOnDay(db, tillId, employeeId, 0, productB, 'Hansa Pilsener', 5)
    sellOnDay(db, tillId, employeeId, 1, productB, 'Hansa Pilsener', 5)

    const insight = stockRunoutInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('warning')
    expect(insight?.message).toBe('**2 products** are likely to run out within 5 days.')
    expect(insight?.navigateTo).toEqual({ screen: 'inventory', params: { sortLowStock: true } })
  })

  it('skips slow movers even if the raw days-remaining looks urgent', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const productId = insertProduct(db, { name: 'Russian & Chips', stockQty: 0.3 })

    // 14 active days at 0.1 units/day (below the 0.2 minimum) -> rate too low to trust
    for (let daysAgo = 0; daysAgo < 14; daysAgo++) {
      sellOnDay(db, tillId, employeeId, daysAgo, productId, 'Russian & Chips', 0.1)
    }

    expect(stockRunoutInsight(db, NOW)).toBeNull()
  })

  it('returns null when there is no sales history at all', () => {
    const db = createTestDb()
    insertProduct(db, { name: 'Castle Lager', stockQty: 20 })
    expect(stockRunoutInsight(db, NOW)).toBeNull()
  })

  it('never flags a product already at zero stock (low-stock alert covers those)', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const productId = insertProduct(db, { name: 'Sold Out Beer', stockQty: 0 })

    sellOnDay(db, tillId, employeeId, 0, productId, 'Sold Out Beer', 10)
    sellOnDay(db, tillId, employeeId, 1, productId, 'Sold Out Beer', 10)

    expect(stockRunoutInsight(db, NOW)).toBeNull()
  })
})

// sanity check the shared date helper used by both the insight and this test
describe('formatLocalDate/addDays sanity', () => {
  it('addDays(-1) moves back one calendar day', () => {
    expect(formatLocalDate(addDays(NOW, -1))).toBe('2026-07-12')
  })
})
