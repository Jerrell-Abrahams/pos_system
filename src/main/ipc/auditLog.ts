import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { AuditLogEntry, AuditLogFilter } from '@shared/types'
import { isSuperUserEntry } from '../lib/auditLog'

interface AuditLogRow {
  id: number
  employee_name: string | null
  action: string
  entity_type: string
  entity_id: number | null
  details: string | null
  created_at: string
}

export function registerAuditLogHandlers(db: Database.Database): void {
  ipcMain.handle('auditLog:list', (_event, filter: AuditLogFilter): AuditLogEntry[] => {
    const q = filter.search.trim()
    const rows = db
      .prepare(
        `SELECT a.id, e.name AS employee_name, a.action, a.entity_type, a.entity_id, a.details, a.created_at
         FROM audit_log a LEFT JOIN employees e ON e.id = a.employee_id
         WHERE date(a.created_at, 'localtime') BETWEEN ? AND ?
           AND (? IS NULL OR a.employee_id = ?)
           AND (? IS NULL OR a.action = ?)
           AND (? = '' OR a.action LIKE '%'||?||'%' OR a.entity_type LIKE '%'||?||'%' OR e.name LIKE '%'||?||'%')
         ORDER BY a.created_at DESC`
      )
      .all(
        filter.startDate,
        filter.endDate,
        filter.employeeId,
        filter.employeeId,
        filter.action,
        filter.action,
        q,
        q,
        q,
        q
      ) as AuditLogRow[]

    return rows.map((r) => ({
      id: r.id,
      // The LEFT JOIN finds no name for a super user entry (it has no employees row), and
      // the screen renders a missing name as "System" — which would disguise support work
      // as the app's own. Name it for what it was.
      employeeName: r.employee_name ?? (isSuperUserEntry(r.details) ? 'Super User' : null),
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
      createdAt: r.created_at
    }))
  })
}
