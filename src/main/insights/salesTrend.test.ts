import { describe, expect, it } from 'vitest'
import { salesTrendInsight } from './salesTrend'
import { createTestDb, insertEmployee, insertSale, insertTill, toDbTimestamp } from '../testUtils'

const NOW = new Date(2026, 6, 13, 15, 0, 0) // Monday, cutoff time 15:00
const LAST_WEEK = new Date(2026, 6, 6, 9, 0, 0) // same weekday, 09:00 — before cutoff
const LAST_WEEK_LATE = new Date(2026, 6, 6, 20, 0, 0) // same weekday, 20:00 — after cutoff

function setup(): { db: ReturnType<typeof createTestDb>; tillId: number; employeeId: number } {
  const db = createTestDb()
  const employeeId = insertEmployee(db)
  const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
  return { db, tillId, employeeId }
}

describe('salesTrendInsight', () => {
  it('reports a good trend when today is up at least 5% vs last week at the same time', () => {
    const { db, tillId, employeeId } = setup()
    insertSale(db, { tillId, employeeId, totalCents: 100000, createdAt: toDbTimestamp(LAST_WEEK) })
    // Sale after last week's cutoff time must not count toward the comparison.
    insertSale(db, { tillId, employeeId, totalCents: 500000, createdAt: toDbTimestamp(LAST_WEEK_LATE) })
    insertSale(db, { tillId, employeeId, totalCents: 120000, createdAt: toDbTimestamp(NOW) })

    const insight = salesTrendInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('good')
    expect(insight?.message).toMatch(/up \*\*20%\*\* compared to last \w+\./)
  })

  it('reports a warning when today is down at least 15% vs last week', () => {
    const { db, tillId, employeeId } = setup()
    insertSale(db, { tillId, employeeId, totalCents: 100000, createdAt: toDbTimestamp(LAST_WEEK) })
    insertSale(db, { tillId, employeeId, totalCents: 80000, createdAt: toDbTimestamp(NOW) })

    const insight = salesTrendInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('warning')
    expect(insight?.message).toMatch(/down \*\*20%\*\* compared to last \w+\./)
  })

  it('suppresses the insight when the change is within the unremarkable band', () => {
    const { db, tillId, employeeId } = setup()
    insertSale(db, { tillId, employeeId, totalCents: 100000, createdAt: toDbTimestamp(LAST_WEEK) })
    insertSale(db, { tillId, employeeId, totalCents: 102000, createdAt: toDbTimestamp(NOW) })

    expect(salesTrendInsight(db, NOW)).toBeNull()
  })

  it('suppresses the insight when last week has no sales to compare against', () => {
    const { db, tillId, employeeId } = setup()
    insertSale(db, { tillId, employeeId, totalCents: 120000, createdAt: toDbTimestamp(NOW) })

    expect(salesTrendInsight(db, NOW)).toBeNull()
  })
})
