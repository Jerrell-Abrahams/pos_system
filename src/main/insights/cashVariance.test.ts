import { describe, expect, it } from 'vitest'
import { cashVarianceInsight } from './cashVariance'
import { closeTillAt, createTestDb, insertEmployee, insertTill, toDbTimestamp } from '../testUtils'

const NOW = new Date(2026, 6, 13, 15, 0, 0)

describe('cashVarianceInsight', () => {
  it('reports critical when cash counted is more than R50 short', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    closeTillAt(db, tillId, employeeId, 42000, 50000, toDbTimestamp(NOW))

    const insight = cashVarianceInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('critical')
    expect(insight?.message).toBe('Cash counted was **R80 less** than expected at last till close.')
  })

  it('reports warning when cash counted is more than R50 over', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    closeTillAt(db, tillId, employeeId, 56000, 50000, toDbTimestamp(NOW))

    const insight = cashVarianceInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('warning')
    expect(insight?.message).toBe('Cash counted was **R60 more** than expected at last till close.')
  })

  it('reports good when the till balanced within R50', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    closeTillAt(db, tillId, employeeId, 48200, 50000, toDbTimestamp(NOW))

    const insight = cashVarianceInsight(db, NOW)
    expect(insight).not.toBeNull()
    expect(insight?.level).toBe('good')
    expect(insight?.message).toBe('Last till close balanced within **R18**.')
  })

  it('returns null when no till has closed today', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db)
    insertTill(db, employeeId, toDbTimestamp(NOW))

    expect(cashVarianceInsight(db, NOW)).toBeNull()
  })

  it('honors a custom insight_cash_variance_threshold_cents setting', () => {
    const db = createTestDb()
    db.prepare(`INSERT INTO settings (key, value) VALUES ('insight_cash_variance_threshold_cents', '2000')`).run()
    const employeeId = insertEmployee(db)
    const tillId = insertTill(db, employeeId, toDbTimestamp(NOW))
    // R30 short — under the default R50 threshold, but over the custom R20 one
    closeTillAt(db, tillId, employeeId, 47000, 50000, toDbTimestamp(NOW))

    const insight = cashVarianceInsight(db, NOW)
    expect(insight?.level).toBe('critical')
  })
})
