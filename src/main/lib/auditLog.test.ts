import { describe, expect, it } from 'vitest'
import { diffFields, logAudit } from './auditLog'
import { createTestDb, insertEmployee } from '../testUtils'

describe('logAudit', () => {
  it('records the actor, action, entity, and details for later lookup', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db, 'manager')

    logAudit(db, {
      employeeId,
      action: 'product.update',
      entityType: 'product',
      entityId: 42,
      details: { name: 'Castle Lager', sellPriceCents: 2800 }
    })

    const row = db.prepare('SELECT * FROM audit_log').get() as {
      employee_id: number
      action: string
      entity_type: string
      entity_id: number
      details: string
      created_at: string
    }
    expect(row.employee_id).toBe(employeeId)
    expect(row.action).toBe('product.update')
    expect(row.entity_type).toBe('product')
    expect(row.entity_id).toBe(42)
    expect(JSON.parse(row.details)).toEqual({ name: 'Castle Lager', sellPriceCents: 2800 })
    expect(row.created_at).toBeTruthy()
  })

  it('allows a null entity id and omitted details for actions with no single target', () => {
    const db = createTestDb()
    const employeeId = insertEmployee(db, 'manager')

    logAudit(db, { employeeId, action: 'settings.update', entityType: 'settings', entityId: null })

    const row = db.prepare('SELECT entity_id, details FROM audit_log').get() as {
      entity_id: number | null
      details: string | null
    }
    expect(row.entity_id).toBeNull()
    expect(row.details).toBeNull()
  })
})

describe('diffFields', () => {
  it('includes only the fields that actually changed', () => {
    const before = { name: 'Castle Lager', sellPriceCents: 2800, active: true }
    const after = { name: 'Castle Lager', sellPriceCents: 3200, active: true }

    expect(diffFields(before, after, ['name', 'sellPriceCents', 'active'])).toEqual({
      sellPriceCents: { before: 2800, after: 3200 }
    })
  })

  it('returns an empty object when nothing changed', () => {
    const row = { name: 'Castle Lager', active: true }
    expect(diffFields(row, { ...row }, ['name', 'active'])).toEqual({})
  })

  it('captures every changed field, not just the first', () => {
    const before = { vatRatePercent: 15, autoLockSeconds: 90 }
    const after = { vatRatePercent: 14, autoLockSeconds: 120 }

    expect(diffFields(before, after, ['vatRatePercent', 'autoLockSeconds'])).toEqual({
      vatRatePercent: { before: 15, after: 14 },
      autoLockSeconds: { before: 90, after: 120 }
    })
  })

  it('compares array fields by contents, not reference — no phantom change on equal arrays', () => {
    const before = { barcodes: ['111', '222'] }
    const after = { barcodes: ['111', '222'] }
    expect(diffFields(before, after, ['barcodes'])).toEqual({})
  })

  it('reports an array field when its contents differ', () => {
    const before = { barcodes: ['111'] }
    const after = { barcodes: ['111', '222'] }
    expect(diffFields(before, after, ['barcodes'])).toEqual({
      barcodes: { before: ['111'], after: ['111', '222'] }
    })
  })
})
