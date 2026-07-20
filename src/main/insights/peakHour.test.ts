import { describe, expect, it } from 'vitest'
import { peakHourInsight } from './peakHour'
import { createTestDb, insertEmployee, insertSale, insertTill, toDbTimestamp } from '../testUtils'

describe('peakHourInsight', () => {
  it('reports the busiest completed hour when it is the best of the day so far', () => {
    const now = new Date(2026, 6, 13, 21, 30, 0)
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(now))

    insertSale(db, {
      tillId,
      employeeId,
      totalCents: 100000,
      createdAt: toDbTimestamp(new Date(2026, 6, 13, 18, 30, 0))
    })
    insertSale(db, {
      tillId,
      employeeId,
      totalCents: 234000,
      createdAt: toDbTimestamp(new Date(2026, 6, 13, 20, 15, 0))
    })

    const insight = peakHourInsight(db, now)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('info')
    expect(insight?.message).toBe('This was your busiest hour today: **R2 340** between 20:00–21:00.')
  })

  it('suppresses the insight before 3 completed hours of trading', () => {
    const now = new Date(2026, 6, 13, 2, 15, 0)
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(now))

    insertSale(db, {
      tillId,
      employeeId,
      totalCents: 500000,
      createdAt: toDbTimestamp(new Date(2026, 6, 13, 1, 0, 0))
    })

    expect(peakHourInsight(db, now)).toBeNull()
  })

  it('suppresses the insight when the last completed hour was not the busiest', () => {
    const now = new Date(2026, 6, 13, 21, 30, 0)
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(now))

    insertSale(db, {
      tillId,
      employeeId,
      totalCents: 500000,
      createdAt: toDbTimestamp(new Date(2026, 6, 13, 18, 30, 0))
    })
    insertSale(db, {
      tillId,
      employeeId,
      totalCents: 100000,
      createdAt: toDbTimestamp(new Date(2026, 6, 13, 20, 15, 0))
    })

    expect(peakHourInsight(db, now)).toBeNull()
  })
})
