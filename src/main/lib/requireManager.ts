import type Database from 'better-sqlite3'
import { SUPER_USER_ID } from '@shared/types'

// Was five byte-identical copies across the ipc handlers. Consolidated here so the
// super user exemption below lands on every manager-gated path at once rather than
// depending on someone remembering to add it to a sixth copy.
//
// Note this trusts the caller's employeeId, exactly as the five copies did: the
// renderer supplies it after ManagerPinModal checks a PIN. That's the existing trust
// boundary -- employees:list already hands the renderer every manager id, so a
// compromised renderer could always pass one. The super user id is no weaker.
export function requireManager(db: Database.Database, employeeId: number): void {
  if (employeeId === SUPER_USER_ID) return
  const manager = db
    .prepare(`SELECT id FROM employees WHERE id = ? AND role = 'manager' AND active = 1`)
    .get(employeeId)
  if (!manager) throw new Error('Manager authorization required')
}
