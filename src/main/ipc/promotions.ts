import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { Combo, ComboCreateInput, ComboItemInput, ComboUpdateInput } from '@shared/types'
import { diffFields, logAudit } from '../lib/auditLog'
import { requireManager } from '../lib/requireManager'
import { insertOutbox } from '../lib/outbox'

interface ComboRow {
  id: number
  name: string
  price_cents: number
  active: number
}

interface ComboItemRow {
  combo_id: number
  product_id: number
  product_name: string
  qty: number
  sell_price_cents: number
}

function validateItems(db: Database.Database, items: ComboItemInput[]): void {
  if (items.length === 0) throw new Error('A combo needs at least one item')
  const productStmt = db.prepare('SELECT id FROM products WHERE id = ? AND active = 1')
  for (const item of items) {
    if (item.qty <= 0) throw new Error('Each combo item quantity must be positive')
    if (!productStmt.get(item.productId)) throw new Error(`Product ${item.productId} not found or inactive`)
  }
}

function toCombo(combo: ComboRow, itemRows: ComboItemRow[]): Combo {
  const items = itemRows.filter((r) => r.combo_id === combo.id)
  return {
    id: combo.id,
    name: combo.name,
    priceCents: combo.price_cents,
    active: combo.active === 1,
    items: items.map((r) => ({ productId: r.product_id, productName: r.product_name, qty: r.qty })),
    componentsCents: items.reduce((sum, r) => sum + r.sell_price_cents * r.qty, 0)
  }
}

function insertComboItems(db: Database.Database, comboId: number, items: ComboItemInput[]): void {
  const insertItem = db.prepare('INSERT INTO combo_items (combo_id, product_id, qty) VALUES (?, ?, ?)')
  for (const item of items) insertItem.run(comboId, item.productId, item.qty)
}

export function registerPromotionsHandlers(db: Database.Database): void {
  const itemRowsStmt = db.prepare(
    `SELECT ci.combo_id, ci.product_id, p.name AS product_name, ci.qty, p.sell_price_cents
     FROM combo_items ci JOIN products p ON p.id = ci.product_id`
  )

  ipcMain.handle('promotions:list', (): Combo[] => {
    const combos = db.prepare('SELECT id, name, price_cents, active FROM combos ORDER BY name').all() as ComboRow[]
    const itemRows = itemRowsStmt.all() as ComboItemRow[]
    return combos.map((c) => toCombo(c, itemRows))
  })

  ipcMain.handle('promotions:create', (_event, input: ComboCreateInput): Combo => {
    if (!input.name.trim()) throw new Error('Combo name is required')
    if (input.priceCents <= 0) throw new Error('Combo price must be positive')
    validateItems(db, input.items)
    requireManager(db, input.authorizedBy)

    const createCombo = db.transaction((): number => {
      const id = Number(
        db
          .prepare('INSERT INTO combos (name, price_cents, active) VALUES (?, ?, 1)')
          .run(input.name.trim(), input.priceCents).lastInsertRowid
      )
      insertComboItems(db, id, input.items)
      return id
    })

    const id = createCombo()
    const combo = db.prepare('SELECT id, name, price_cents, active FROM combos WHERE id = ?').get(id) as ComboRow
    const itemRows = itemRowsStmt.all() as ComboItemRow[]
    insertOutbox(db, 'combos', id, 'insert', { ...combo, items: input.items })
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'combo.create',
      entityType: 'combo',
      entityId: id,
      details: { name: combo.name, priceCents: combo.price_cents }
    })
    return toCombo(combo, itemRows)
  })

  ipcMain.handle('promotions:update', (_event, input: ComboUpdateInput): Combo => {
    if (!input.name.trim()) throw new Error('Combo name is required')
    if (input.priceCents <= 0) throw new Error('Combo price must be positive')
    validateItems(db, input.items)
    requireManager(db, input.authorizedBy)

    const beforeCombo = db.prepare('SELECT id, name, price_cents, active FROM combos WHERE id = ?').get(input.id) as
      | ComboRow
      | undefined
    if (!beforeCombo) throw new Error('Combo not found')
    const beforeItems = (itemRowsStmt.all() as ComboItemRow[])
      .filter((r) => r.combo_id === input.id)
      .map((r) => `${r.product_id}:${r.qty}`)
      .sort()

    const updateCombo = db.transaction((): void => {
      db.prepare(`UPDATE combos SET name = ?, price_cents = ?, active = ?, updated_at = datetime('now') WHERE id = ?`).run(
        input.name.trim(),
        input.priceCents,
        input.active ? 1 : 0,
        input.id
      )
      db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(input.id)
      insertComboItems(db, input.id, input.items)
    })

    updateCombo()
    const combo = db.prepare('SELECT id, name, price_cents, active FROM combos WHERE id = ?').get(input.id) as
      | ComboRow
      | undefined
    if (!combo) throw new Error('Combo not found')
    const itemRows = itemRowsStmt.all() as ComboItemRow[]
    insertOutbox(db, 'combos', input.id, 'update', { ...combo, items: input.items })

    const afterItems = itemRows
      .filter((r) => r.combo_id === input.id)
      .map((r) => `${r.product_id}:${r.qty}`)
      .sort()
    const changes = diffFields(
      { name: beforeCombo.name, priceCents: beforeCombo.price_cents, active: beforeCombo.active === 1 },
      { name: combo.name, priceCents: combo.price_cents, active: combo.active === 1 },
      ['name', 'priceCents', 'active']
    )
    const itemsChanged = beforeItems.join(',') !== afterItems.join(',')
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'combo.update',
      entityType: 'combo',
      entityId: input.id,
      details: { changes, itemsChanged }
    })
    return toCombo(combo, itemRows)
  })
}
