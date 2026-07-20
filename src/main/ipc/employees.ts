import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'
import type { EmployeeCreateInput, EmployeeListItem, EmployeeRole, EmployeeUpdateInput } from '@shared/types'
import { diffFields, logAudit } from '../lib/auditLog'
import { requireManager } from '../lib/requireManager'

interface EmployeeRow {
  id: number
  name: string
  role: EmployeeRole
  active: number
}

function toListItem(row: EmployeeRow): EmployeeListItem {
  return { id: row.id, name: row.name, role: row.role, active: row.active === 1 }
}

function requirePinFormat(pin: string): void {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4 to 6 digits')
}

// Login only ever checks active employees (see auth.ts), so a PIN collision only matters
// among active accounts — an inactive employee's old PIN can safely be reused.
function pinInUseByAnotherActiveEmployee(db: Database.Database, pin: string, excludeId: number | null): boolean {
  const rows = db
    .prepare(
      excludeId === null
        ? 'SELECT pin_hash FROM employees WHERE active = 1'
        : 'SELECT pin_hash FROM employees WHERE active = 1 AND id != ?'
    )
    .all(...(excludeId === null ? [] : [excludeId])) as { pin_hash: string }[]
  return rows.some((r) => bcrypt.compareSync(pin, r.pin_hash))
}

function wouldLeaveNoActiveManager(db: Database.Database, employeeId: number, active: boolean, role: EmployeeRole): boolean {
  if (active && role === 'manager') return false
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM employees WHERE role = 'manager' AND active = 1 AND id != ?`)
    .get(employeeId) as { n: number }
  return row.n === 0
}

export function registerEmployeesHandlers(db: Database.Database): void {
  ipcMain.handle('employees:list', (): EmployeeListItem[] => {
    const rows = db.prepare('SELECT id, name, role, active FROM employees ORDER BY name').all() as EmployeeRow[]
    return rows.map(toListItem)
  })

  ipcMain.handle('employees:create', (_event, input: EmployeeCreateInput): EmployeeListItem => {
    requireManager(db, input.authorizedBy)
    const name = input.name.trim()
    if (!name) throw new Error('Employee name is required')
    requirePinFormat(input.pin)
    if (pinInUseByAnotherActiveEmployee(db, input.pin, null)) {
      throw new Error('That PIN is already in use by another active employee')
    }

    const pinHash = bcrypt.hashSync(input.pin, 10)
    const id = Number(
      db
        .prepare(`INSERT INTO employees (name, pin_hash, role, active) VALUES (?, ?, ?, 1)`)
        .run(name, pinHash, input.role).lastInsertRowid
    )
    const row = db.prepare('SELECT id, name, role, active FROM employees WHERE id = ?').get(id) as EmployeeRow
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'employee.create',
      entityType: 'employee',
      entityId: id,
      details: { name: row.name, role: row.role }
    })
    return toListItem(row)
  })

  ipcMain.handle('employees:update', (_event, input: EmployeeUpdateInput): EmployeeListItem => {
    requireManager(db, input.authorizedBy)
    const name = input.name.trim()
    if (!name) throw new Error('Employee name is required')

    const beforeRow = db.prepare('SELECT id, name, role, active FROM employees WHERE id = ?').get(input.id) as
      | EmployeeRow
      | undefined
    if (!beforeRow) throw new Error('Employee not found')

    if (wouldLeaveNoActiveManager(db, input.id, input.active, input.role)) {
      throw new Error('At least one active manager must remain')
    }

    if (input.pin) {
      requirePinFormat(input.pin)
      if (pinInUseByAnotherActiveEmployee(db, input.pin, input.id)) {
        throw new Error('That PIN is already in use by another active employee')
      }
      const pinHash = bcrypt.hashSync(input.pin, 10)
      db.prepare(
        `UPDATE employees SET name = ?, role = ?, active = ?, pin_hash = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(name, input.role, input.active ? 1 : 0, pinHash, input.id)
    } else {
      db.prepare(`UPDATE employees SET name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?`).run(
        name,
        input.role,
        input.active ? 1 : 0,
        input.id
      )
    }

    const row = db.prepare('SELECT id, name, role, active FROM employees WHERE id = ?').get(input.id) as EmployeeRow
    const changes = diffFields(toListItem(beforeRow), toListItem(row), ['name', 'role', 'active'])
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'employee.update',
      entityType: 'employee',
      entityId: input.id,
      details: { changes, pinChanged: Boolean(input.pin) }
    })
    return toListItem(row)
  })
}
