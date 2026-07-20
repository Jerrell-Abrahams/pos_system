import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'
import { SUPER_USER_ID, type LoginResult } from '@shared/types'
import { isSuperUserCode } from '../lib/superUser'

interface EmployeeRow {
  id: number
  name: string
  pin_hash: string
  role: 'cashier' | 'manager'
}

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000

// ponytail: in-memory, per-till lockout (resets on app restart) -- a 4-digit PIN space is
// exhaustible in seconds without this. Per-employee/persisted lockout tracking if a customer
// ever needs it to survive restarts or wants per-employee attempt history.
let failedAttempts = 0
let lockedUntil = 0

export function registerAuthHandlers(db: Database.Database): void {
  ipcMain.handle('auth:login', (_event, pin: string): LoginResult => {
    const now = Date.now()
    if (now < lockedUntil) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)}s.` }
    }

    const employees = db
      .prepare('SELECT id, name, pin_hash, role FROM employees WHERE active = 1')
      .all() as EmployeeRow[]

    const match = employees.find((emp) => bcrypt.compareSync(pin, emp.pin_hash))
    if (match) {
      failedAttempts = 0
      return { ok: true, employee: { id: match.id, name: match.name, role: match.role } }
    }

    // Checked last so a real employee's PIN can never be shadowed by the super user code.
    // Sharing this handler's lockout is deliberate: it's the only thing standing between
    // the code and an online brute force, and the code grants manager rights.
    if (isSuperUserCode(db, pin)) {
      failedAttempts = 0
      return { ok: true, employee: { id: SUPER_USER_ID, name: 'Super User', role: 'manager', isSuper: true } }
    }

    failedAttempts += 1
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockedUntil = now + LOCKOUT_MS
      failedAttempts = 0
    }
    return { ok: false, error: 'Incorrect PIN' }
  })
}
