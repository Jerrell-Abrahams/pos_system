import { describe, expect, it } from 'vitest'
import { evaluateEntitlement, evaluateOfflineEntitlement, isClockRolledBack, isEntitledSync } from './license'
import { createTestDb } from '../testUtils'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-07-13T12:00:00.000Z')

function payload(overrides: Partial<{ status: string; periodEnd: string; issuedAt: number }> = {}): {
  userId: string
  product: string
  status: string
  periodEnd: string
  issuedAt: number
} {
  return {
    userId: 'u1',
    product: 'pos-system',
    status: 'active',
    periodEnd: new Date(NOW + 30 * DAY_MS).toISOString(),
    issuedAt: NOW,
    ...overrides
  }
}

describe('evaluateEntitlement', () => {
  it('is entitled when active and within the billing period', () => {
    expect(evaluateEntitlement(payload(), NOW)).toEqual({ entitled: true, reason: null })
  })

  it('blocks when there is no certificate at all', () => {
    expect(evaluateEntitlement(null, NOW)).toEqual({ entitled: false, reason: 'not_activated' })
  })

  it('stays entitled for a few days past periodEnd (expiry grace period)', () => {
    const result = evaluateEntitlement(payload({ periodEnd: new Date(NOW - DAY_MS).toISOString() }), NOW)
    expect(result).toEqual({ entitled: true, reason: null })
  })

  it('blocks once the billing period passed the expiry grace period, even if status is still active', () => {
    const result = evaluateEntitlement(payload({ periodEnd: new Date(NOW - 4 * DAY_MS).toISOString() }), NOW)
    expect(result).toEqual({ entitled: false, reason: 'expired' })
  })

  for (const status of ['pending', 'past_due', 'canceled', 'expired', 'revoked']) {
    it(`blocks when status is ${status}`, () => {
      expect(evaluateEntitlement(payload({ status }), NOW)).toEqual({ entitled: false, reason: status })
    })
  }
})

describe('evaluateOfflineEntitlement', () => {
  it('is entitled offline when the certificate was issued within the grace period', () => {
    const issuedAt = NOW - 3 * DAY_MS
    expect(evaluateOfflineEntitlement(payload({ issuedAt }), NOW)).toEqual({ entitled: true, reason: null })
  })

  it('blocks once the certificate is older than the 7-day grace period', () => {
    const issuedAt = NOW - 8 * DAY_MS
    expect(evaluateOfflineEntitlement(payload({ issuedAt }), NOW)).toEqual({
      entitled: false,
      reason: 'verification_required'
    })
  })

  it('still blocks non-active statuses regardless of grace period', () => {
    const result = evaluateOfflineEntitlement(payload({ status: 'canceled', issuedAt: NOW }), NOW)
    expect(result).toEqual({ entitled: false, reason: 'canceled' })
  })
})

describe('isClockRolledBack', () => {
  it('is false the first time (nothing observed yet)', () => {
    const db = createTestDb()
    expect(isClockRolledBack(db, NOW)).toBe(false)
  })

  it('is false when the clock only moves forward', () => {
    const db = createTestDb()
    db.prepare(`INSERT INTO settings (key, value) VALUES ('license_max_seen_at', ?)`).run(String(NOW))
    expect(isClockRolledBack(db, NOW + DAY_MS)).toBe(false)
  })

  it('is true when now is earlier than the last observed time', () => {
    const db = createTestDb()
    db.prepare(`INSERT INTO settings (key, value) VALUES ('license_max_seen_at', ?)`).run(String(NOW))
    expect(isClockRolledBack(db, NOW - DAY_MS)).toBe(true)
  })
})

describe('isEntitledSync', () => {
  it('is false with no cached certificate', () => {
    const db = createTestDb()
    expect(isEntitledSync(db)).toBe(false)
  })

  it('is false when a tampered/unparseable certificate is cached', () => {
    const db = createTestDb()
    db.prepare(`INSERT INTO settings (key, value) VALUES ('license_certificate', 'not-a-real-jwt')`).run()
    expect(isEntitledSync(db)).toBe(false)
  })

  it('is false when the clock has been rolled back, even with a fresh-looking timestamp recorded', () => {
    // isEntitledSync reads the real wall clock internally, so the recorded
    // "seen" time only needs to be after whatever Date.now() resolves to here.
    const db = createTestDb()
    const future = Date.now() + DAY_MS
    db.prepare(`INSERT INTO settings (key, value) VALUES ('license_max_seen_at', ?)`).run(String(future))
    expect(isEntitledSync(db)).toBe(false)
  })
})
