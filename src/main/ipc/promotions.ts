import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type {
  Combo,
  ComboCategory,
  ComboCreateInput,
  ComboItemInput,
  ComboItemRole,
  ComboUpdateInput
} from '@shared/types'
import { diffFields, logAudit } from '../lib/auditLog'
import { requireManager } from '../lib/requireManager'
import { insertOutbox } from '../lib/outbox'

interface ComboRow {
  id: number
  name: string
  price_cents: number
  active: number
  category: string
  charge_extra_cents: number | null
}

interface ComboItemRow {
  combo_id: number
  product_id: number
  product_name: string
  qty: number
  role: string | null
  sell_price_cents: number
}

// The concrete rows a combo resolves to, whether free-form (Specials) or guided (spirit).
interface BuiltCombo {
  name: string
  priceCents: number
  chargeExtraCents: number | null
  items: { productId: number; qty: number; role: ComboItemRole }[]
}

function validateItems(db: Database.Database, items: ComboItemInput[]): void {
  const productStmt = db.prepare('SELECT id FROM products WHERE id = ? AND active = 1')
  for (const item of items) {
    if (item.qty <= 0) throw new Error('Each combo item quantity must be positive')
    if (!productStmt.get(item.productId)) throw new Error(`Product ${item.productId} not found or inactive`)
  }
}

// A spirit combo = a bottle + one always-included Ice + a mixer, priced (bottle + chargeExtra).
// Exported for tests: this is the money + inventory path (which products get deducted, at what price).
export function buildSpiritCombo(
  db: Database.Database,
  input: { bottleProductId: number; mixerProductId: number; chargeExtraCents: number }
): BuiltCombo {
  if (input.chargeExtraCents < 0) throw new Error('Charge extra cannot be negative')
  const bottle = db
    .prepare('SELECT id, name, sell_price_cents FROM products WHERE id = ? AND active = 1')
    .get(input.bottleProductId) as { id: number; name: string; sell_price_cents: number } | undefined
  if (!bottle) throw new Error('Bottle product not found or inactive')
  const mixer = db.prepare('SELECT id, name FROM products WHERE id = ? AND active = 1').get(input.mixerProductId) as
    | { id: number; name: string }
    | undefined
  if (!mixer) throw new Error('Mixer product not found or inactive')
  // Ice is resolved by name, not chosen per combo — the shop keeps a single "Ice" product.
  const ice = db.prepare(`SELECT id FROM products WHERE lower(name) = 'ice' AND active = 1 ORDER BY id LIMIT 1`).get() as
    | { id: number }
    | undefined
  if (!ice) throw new Error(`No active product named 'Ice' exists — create one to build spirit combos`)

  return {
    name: `${bottle.name} + ${mixer.name}`,
    priceCents: bottle.sell_price_cents + input.chargeExtraCents,
    chargeExtraCents: input.chargeExtraCents,
    items: [
      { productId: bottle.id, qty: 1, role: 'bottle' },
      { productId: ice.id, qty: 1, role: 'ice' },
      { productId: mixer.id, qty: 1, role: 'mixer' }
    ]
  }
}

// Resolves either combo shape to concrete rows, validating as it goes.
function buildCombo(db: Database.Database, input: ComboCreateInput): BuiltCombo {
  if (input.category === 'Specials') {
    if (!input.name.trim()) throw new Error('Combo name is required')
    if (input.priceCents <= 0) throw new Error('Combo price must be positive')
    if (input.items.length === 0) throw new Error('A combo needs at least one item')
    validateItems(db, input.items)
    return {
      name: input.name.trim(),
      priceCents: input.priceCents,
      chargeExtraCents: null,
      items: input.items.map((i) => ({ productId: i.productId, qty: i.qty, role: null }))
    }
  }
  if (input.bottleProductId == null || input.mixerProductId == null || input.chargeExtraCents == null) {
    throw new Error('A spirit combo needs a bottle, a mixer and a charge extra')
  }
  const built = buildSpiritCombo(db, {
    bottleProductId: input.bottleProductId,
    mixerProductId: input.mixerProductId,
    chargeExtraCents: input.chargeExtraCents
  })
  // A typed name wins; blank falls back to the auto "bottle + mixer".
  if (input.name.trim()) built.name = input.name.trim()
  return built
}

function toCombo(combo: ComboRow, itemRows: ComboItemRow[]): Combo {
  const items = itemRows.filter((r) => r.combo_id === combo.id)
  return {
    id: combo.id,
    name: combo.name,
    priceCents: combo.price_cents,
    active: combo.active === 1,
    category: combo.category as ComboCategory,
    chargeExtraCents: combo.charge_extra_cents,
    items: items.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      qty: r.qty,
      role: r.role as ComboItemRole
    })),
    componentsCents: items.reduce((sum, r) => sum + r.sell_price_cents * r.qty, 0)
  }
}

function insertComboItems(db: Database.Database, comboId: number, items: BuiltCombo['items']): void {
  const insertItem = db.prepare('INSERT INTO combo_items (combo_id, product_id, qty, role) VALUES (?, ?, ?, ?)')
  for (const item of items) insertItem.run(comboId, item.productId, item.qty, item.role)
}

export function registerPromotionsHandlers(db: Database.Database): void {
  const itemRowsStmt = db.prepare(
    `SELECT ci.combo_id, ci.product_id, p.name AS product_name, ci.qty, ci.role, p.sell_price_cents
     FROM combo_items ci JOIN products p ON p.id = ci.product_id`
  )
  const comboByIdStmt = db.prepare(
    'SELECT id, name, price_cents, active, category, charge_extra_cents FROM combos WHERE id = ?'
  )

  ipcMain.handle('promotions:list', (): Combo[] => {
    const combos = db
      .prepare('SELECT id, name, price_cents, active, category, charge_extra_cents FROM combos ORDER BY name')
      .all() as ComboRow[]
    const itemRows = itemRowsStmt.all() as ComboItemRow[]
    return combos.map((c) => toCombo(c, itemRows))
  })

  ipcMain.handle('promotions:create', (_event, input: ComboCreateInput): Combo => {
    const built = buildCombo(db, input)
    requireManager(db, input.authorizedBy)

    const createCombo = db.transaction((): number => {
      const id = Number(
        db
          .prepare('INSERT INTO combos (name, price_cents, category, charge_extra_cents, active) VALUES (?, ?, ?, ?, 1)')
          .run(built.name, built.priceCents, input.category, built.chargeExtraCents).lastInsertRowid
      )
      insertComboItems(db, id, built.items)
      return id
    })

    const id = createCombo()
    const combo = comboByIdStmt.get(id) as ComboRow
    const itemRows = itemRowsStmt.all() as ComboItemRow[]
    insertOutbox(db, 'combos', id, 'insert', { ...combo, items: built.items })
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'combo.create',
      entityType: 'combo',
      entityId: id,
      details: { name: combo.name, priceCents: combo.price_cents, category: combo.category }
    })
    return toCombo(combo, itemRows)
  })

  ipcMain.handle('promotions:update', (_event, input: ComboUpdateInput): Combo => {
    const built = buildCombo(db, input)
    requireManager(db, input.authorizedBy)

    const beforeCombo = comboByIdStmt.get(input.id) as ComboRow | undefined
    if (!beforeCombo) throw new Error('Combo not found')
    const beforeItems = (itemRowsStmt.all() as ComboItemRow[])
      .filter((r) => r.combo_id === input.id)
      .map((r) => `${r.product_id}:${r.qty}`)
      .sort()

    const updateCombo = db.transaction((): void => {
      db.prepare(
        `UPDATE combos SET name = ?, price_cents = ?, category = ?, charge_extra_cents = ?, active = ?,
                updated_at = datetime('now') WHERE id = ?`
      ).run(built.name, built.priceCents, input.category, built.chargeExtraCents, input.active ? 1 : 0, input.id)
      db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(input.id)
      insertComboItems(db, input.id, built.items)
    })

    updateCombo()
    const combo = comboByIdStmt.get(input.id) as ComboRow | undefined
    if (!combo) throw new Error('Combo not found')
    const itemRows = itemRowsStmt.all() as ComboItemRow[]
    insertOutbox(db, 'combos', input.id, 'update', { ...combo, items: built.items })

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
