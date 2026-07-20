import type Database from 'better-sqlite3'
import { SUPER_USER_ID } from '@shared/types'

export type FieldChanges = Record<string, { before: unknown; after: unknown }>

// Marks an entry as the work of the super user. audit_log.employee_id is a foreign key
// to employees(id) and the super user has no row there, so its id can't be stored --
// the actor moves into details instead, and the id is written NULL. Every caller routes
// through logAudit, so doing the swap here is what keeps super user actions on the
// customer's audit trail rather than silently unattributed.
export const SUPER_USER_DETAIL = 'superUser'

export function isSuperUserEntry(details: string | null): boolean {
  if (!details) return false
  try {
    const parsed: unknown = JSON.parse(details)
    return typeof parsed === 'object' && parsed !== null && SUPER_USER_DETAIL in parsed
  } catch {
    return false
  }
}

// Only includes fields that actually changed, so an update that only touches one field
// doesn't drown the audit entry in a wall of unchanged values.
export function diffFields<T>(before: T, after: T, fields: (keyof T)[]): FieldChanges {
  const changes: FieldChanges = {}
  for (const field of fields) {
    if (!valuesEqual(before[field], after[field])) {
      changes[String(field)] = { before: before[field], after: after[field] }
    }
  }
  return changes
}

// Plain === treats two arrays with identical contents as different (reference inequality),
// which would log a phantom change on every save for array-valued fields like product barcodes.
// Compare arrays element-wise; fall back to === for scalars.
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  return a === b
}

export function logAudit(
  db: Database.Database,
  params: {
    employeeId: number | null
    action: string
    entityType: string
    entityId: number | null
    details?: unknown
  }
): void {
  const superUser = params.employeeId === SUPER_USER_ID
  const details = superUser
    ? { [SUPER_USER_DETAIL]: true, ...(params.details as Record<string, unknown> | undefined) }
    : params.details

  db.prepare(
    `INSERT INTO audit_log (employee_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)`
  ).run(
    superUser ? null : params.employeeId,
    params.action,
    params.entityType,
    params.entityId,
    details !== undefined ? JSON.stringify(details) : null
  )
}
