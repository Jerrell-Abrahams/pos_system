import { describe, expect, it } from 'vitest'
import { addDays } from '@shared/dates'
import { voidSpikeInsight } from './voidSpike'
import { createTestDb, insertEmployee, insertSale, insertTill, toDbTimestamp } from '../testUtils'

const NOW = new Date(2026, 6, 13, 15, 0, 0)

describe('voidSpikeInsight', () => {
  it('flags a spike when today is at least 3 and double the 14-day average', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const today = toDbTimestamp(NOW)

    for (let i = 0; i < 5; i++) {
      insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt: today, status: 'voided' })
    }
    // 7 voids scattered across the prior 14 days -> average 0.5/day
    for (let i = 0; i < 7; i++) {
      const createdAt = toDbTimestamp(addDays(NOW, -(1 + (i % 14))))
      insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt, status: 'refunded' })
    }

    const insight = voidSpikeInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('warning')
    expect(insight?.message).toBe(
      '**5 sales** were voided or refunded today — above your usual **less than 1 per day**.'
    )
    expect(insight?.navigateTo).toEqual({ screen: 'salesHistory', params: { voidedOnly: true } })
  })

  it('suppresses the insight when fewer than 3 voids/refunds happened today', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const today = toDbTimestamp(NOW)

    insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt: today, status: 'voided' })
    insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt: today, status: 'voided' })

    expect(voidSpikeInsight(db, NOW)).toBeNull()
  })

  it('suppresses the insight when today is not out of line with the usual rate', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    const today = toDbTimestamp(NOW)

    for (let i = 0; i < 3; i++) {
      insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt: today, status: 'voided' })
    }
    // 84 voids over the prior 14 days -> average 6/day, so today's 3 is not a spike
    for (let i = 0; i < 84; i++) {
      const createdAt = toDbTimestamp(addDays(NOW, -(1 + (i % 14))))
      insertSale(db, { tillId, employeeId, totalCents: 1000, createdAt, status: 'refunded' })
    }

    expect(voidSpikeInsight(db, NOW)).toBeNull()
  })
})
