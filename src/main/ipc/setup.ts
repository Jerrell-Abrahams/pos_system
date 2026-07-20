import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'
import type { FirstManagerInput, SetupStatus } from '@shared/types'
import { logAudit } from '../lib/auditLog'

// An install with no employees cannot be logged into, so this handler is the one place that
// creates an account without a manager PIN authorizing it. That makes "no employees exist yet"
// the entire trust boundary — re-checked inside the write transaction so two racing calls can't
// both pass the check and mint a second unauthorized manager.
function hasEmployees(db: Database.Database): boolean {
  return (db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number }).n > 0
}

export function registerSetupHandlers(db: Database.Database): void {
  ipcMain.handle('setup:status', (): SetupStatus => ({ needsSetup: !hasEmployees(db) }))

  ipcMain.handle('setup:createFirstManager', (_event, input: FirstManagerInput): SetupStatus => {
    const businessName = input.businessName.trim()
    const managerName = input.managerName.trim()
    if (!businessName) throw new Error('Business name is required')
    if (!managerName) throw new Error('Manager name is required')
    if (!/^\d{4,6}$/.test(input.pin)) throw new Error('PIN must be 4 to 6 digits')

    const create = db.transaction((): number => {
      if (hasEmployees(db)) throw new Error('Setup has already been completed')

      const id = Number(
        db
          .prepare(`INSERT INTO employees (name, pin_hash, role, active) VALUES (?, ?, 'manager', 1)`)
          .run(managerName, bcrypt.hashSync(input.pin, 10)).lastInsertRowid
      )
      db.prepare(
        `INSERT INTO settings (key, value) VALUES ('business_name', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(businessName)
      return id
    })

    const managerId = create()
    logAudit(db, {
      employeeId: managerId,
      action: 'setup.complete',
      entityType: 'employee',
      entityId: managerId,
      details: { managerName, businessName }
    })

    return { needsSetup: false }
  })
}
