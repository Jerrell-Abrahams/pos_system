import { describe, expect, it } from 'vitest'
import { createTestDb } from '../testUtils'
import { seed } from './seed'

function count(db: ReturnType<typeof createTestDb>, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
}

function setting(db: ReturnType<typeof createTestDb>, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

describe('seed (production)', () => {
  // The whole point of the demo/production split: a real till must not boot with a known
  // manager PIN or another shop's catalog. If someone moves demo data back into the default
  // path, these fail.
  it('creates no employees, so nobody can log in with a default PIN', () => {
    const db = createTestDb()
    seed(db, false)
    expect(count(db, 'employees')).toBe(0)
  })

  it('creates no products or categories', () => {
    const db = createTestDb()
    seed(db, false)
    expect(count(db, 'products')).toBe(0)
    expect(count(db, 'categories')).toBe(0)
  })

  it('leaves shop identity unset rather than seeding a demo business', () => {
    const db = createTestDb()
    seed(db, false)
    expect(setting(db, 'business_name')).toBeNull()
    expect(setting(db, 'business_address')).toBeNull()
  })

  it('still seeds real operating defaults', () => {
    const db = createTestDb()
    seed(db, false)
    expect(setting(db, 'vat_rate')).toBe('15')
    expect(setting(db, 'auto_lock_seconds')).toBe('90')
    expect(setting(db, 'discount_threshold_percent')).toBe('20')
    expect(setting(db, 'insight_cash_variance_threshold_cents')).toBe('5000')
  })

  it('is safe to re-run and never overwrites an edited setting', () => {
    const db = createTestDb()
    seed(db, false)
    db.prepare(`UPDATE settings SET value = '20' WHERE key = 'vat_rate'`).run()
    seed(db, false)
    expect(setting(db, 'vat_rate')).toBe('20')
    expect(count(db, 'display_profiles')).toBe(1)
  })
})

describe('seed (demo)', () => {
  it('seeds the demo shop for local development', () => {
    const db = createTestDb()
    seed(db, true)
    expect(count(db, 'employees')).toBe(2)
    expect(count(db, 'products')).toBe(53)
    expect(setting(db, 'business_name')).toBe('The Thirsty Springbok')
  })

  it('does not duplicate demo data on a second run', () => {
    const db = createTestDb()
    seed(db, true)
    seed(db, true)
    expect(count(db, 'employees')).toBe(2)
    expect(count(db, 'products')).toBe(53)
  })
})
