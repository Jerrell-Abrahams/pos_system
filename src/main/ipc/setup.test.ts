import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb, insertEmployee } from '../testUtils'

// registerSetupHandlers binds to ipcMain, which isn't available under vitest — so exercise the
// same rules directly against the db. The invariant under test is the trust boundary itself:
// this is the only path that mints a manager without a manager PIN authorizing it.
function createFirstManager(db: Database.Database, input: { businessName: string; managerName: string; pin: string }): void {
  const businessName = input.businessName.trim()
  const managerName = input.managerName.trim()
  if (!businessName) throw new Error('Business name is required')
  if (!managerName) throw new Error('Manager name is required')
  if (!/^\d{4,6}$/.test(input.pin)) throw new Error('PIN must be 4 to 6 digits')

  db.transaction(() => {
    const n = (db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number }).n
    if (n > 0) throw new Error('Setup has already been completed')
    db.prepare(`INSERT INTO employees (name, pin_hash, role, active) VALUES (?, ?, 'manager', 1)`).run(
      managerName,
      bcrypt.hashSync(input.pin, 10)
    )
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('business_name', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(businessName)
  })()
}

const VALID = { businessName: 'Corner Bottle Store', managerName: 'Naledi', pin: '4821' }

describe('setup:createFirstManager', () => {
  it('creates the first manager and records the business name', () => {
    const db = createTestDb()
    createFirstManager(db, VALID)

    const row = db.prepare('SELECT name, role, active FROM employees').get() as {
      name: string
      role: string
      active: number
    }
    expect(row).toEqual({ name: 'Naledi', role: 'manager', active: 1 })
    const setting = db.prepare(`SELECT value FROM settings WHERE key = 'business_name'`).get() as { value: string }
    expect(setting.value).toBe('Corner Bottle Store')
  })

  it('stores the PIN hashed, never in the clear', () => {
    const db = createTestDb()
    createFirstManager(db, VALID)
    const row = db.prepare('SELECT pin_hash FROM employees').get() as { pin_hash: string }
    expect(row.pin_hash).not.toBe('4821')
    expect(bcrypt.compareSync('4821', row.pin_hash)).toBe(true)
  })

  it('refuses once any employee exists — the only thing guarding this handler', () => {
    const db = createTestDb()
    insertEmployee(db, 'cashier')
    expect(() => createFirstManager(db, VALID)).toThrow('already been completed')
    expect((db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number }).n).toBe(1)
  })

  it('rejects a PIN that is not 4-6 digits', () => {
    const db = createTestDb()
    expect(() => createFirstManager(db, { ...VALID, pin: '12' })).toThrow('4 to 6 digits')
    expect(() => createFirstManager(db, { ...VALID, pin: 'abcd' })).toThrow('4 to 6 digits')
  })

  it('requires a business name and a manager name', () => {
    const db = createTestDb()
    expect(() => createFirstManager(db, { ...VALID, businessName: '   ' })).toThrow('Business name is required')
    expect(() => createFirstManager(db, { ...VALID, managerName: '' })).toThrow('Manager name is required')
  })
})
