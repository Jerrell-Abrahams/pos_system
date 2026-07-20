import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { closeTill, getOpenTill, openTill } from '../db/till'
import { ensureDeviceId } from '../db/deviceId'
import { logAudit } from '../lib/auditLog'
import { insertOutbox } from '../lib/outbox'
import { isEntitledSync } from '../lib/license'
import { requireRealEmployee } from '../lib/superUser'
import type { TillCloseResult, TillStatus } from '@shared/types'

export function registerTillHandlers(db: Database.Database): void {
  ipcMain.handle('till:status', (): TillStatus => ({ till: getOpenTill(db) }))

  ipcMain.handle(
    'till:open',
    (_event, input: { employeeId: number; openingCashCents: number }): TillStatus => {
      if (!isEntitledSync(db)) throw new Error('Subscription inactive')
      requireRealEmployee(input.employeeId)
      const deviceId = ensureDeviceId(db)
      const till = openTill(db, deviceId, input.employeeId, input.openingCashCents)
      insertOutbox(db, 'tills', till.id, 'insert', {
        id: till.id,
        till_device_id: till.tillDeviceId,
        opened_by: input.employeeId,
        opening_cash_cents: till.openingCashCents,
        status: 'open'
      })
      logAudit(db, {
        employeeId: input.employeeId,
        action: 'till.open',
        entityType: 'till',
        entityId: till.id,
        details: { openingCashCents: till.openingCashCents }
      })
      return { till }
    }
  )

  ipcMain.handle(
    'till:close',
    (_event, input: { employeeId: number; closingCashCents: number }): TillCloseResult => {
      requireRealEmployee(input.employeeId)
      const result = closeTill(db, input.employeeId, input.closingCashCents)
      insertOutbox(db, 'tills', result.id, 'update', {
        id: result.id,
        closed_by: input.employeeId,
        closing_cash_cents: result.closingCashCents,
        expected_cash_cents: result.expectedCashCents,
        cash_difference_cents: result.differenceCents,
        status: 'closed'
      })
      logAudit(db, {
        employeeId: input.employeeId,
        action: 'till.close',
        entityType: 'till',
        entityId: result.id,
        details: { closingCashCents: result.closingCashCents, differenceCents: result.differenceCents }
      })
      return result
    }
  )
}
