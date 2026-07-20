import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type {
  ProductCreateInput,
  ProductDeleteInput,
  ProductDetail,
  ProductsPayload,
  ProductUpdateInput
} from '@shared/types'
import { diffFields, logAudit } from '../lib/auditLog'
import { requireManager } from '../lib/requireManager'
import { insertOutbox } from '../lib/outbox'

interface CategoryRow {
  id: number
  name: string
  sort_order: number
}

interface ProductRow {
  id: number
  name: string
  category_id: number | null
  sell_price_cents: number
  cost_price_cents: number
  stock_qty: number
  low_stock_threshold: number
  active: number
  is_6_pack: number
  split_target_product_id: number | null
}

function toProductDetail(row: ProductRow, barcodes: string[]): ProductDetail {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    sellPriceCents: row.sell_price_cents,
    costPriceCents: row.cost_price_cents,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    barcodes,
    active: row.active === 1,
    is6Pack: row.is_6_pack === 1,
    splitTargetProductId: row.split_target_product_id
  }
}

// Resolves and validates the two split-pack fields for a save. split_target_product_id only means
// anything when is_6_pack is set, so it's forced NULL otherwise. A pack can't split into itself,
// and the target must exist — a friendly error rather than a raw FK failure at write time.
function resolveSplitTarget(
  db: Database.Database,
  is6Pack: boolean,
  splitTargetProductId: number | null,
  selfId: number | null
): number | null {
  if (!is6Pack || splitTargetProductId == null) return null
  if (selfId !== null && splitTargetProductId === selfId) {
    throw new Error('A 6-pack cannot split into itself')
  }
  const target = db.prepare('SELECT id FROM products WHERE id = ?').get(splitTargetProductId)
  if (!target) throw new Error('The selected single product does not exist')
  return splitTargetProductId
}

// Trims each code, drops blanks, and removes duplicates within the one product's list — the same
// barcode typed or scanned twice is one barcode, not an error to surface.
export function normalizeBarcodes(raw: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of raw) {
    const code = entry.trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    result.push(code)
  }
  return result
}

function barcodesFor(db: Database.Database, productId: number): string[] {
  return (
    db.prepare('SELECT barcode FROM product_barcodes WHERE product_id = ? ORDER BY barcode').all(productId) as {
      barcode: string
    }[]
  ).map((r) => r.barcode)
}

// Replaces a product's barcode set. A code already owned by a DIFFERENT product is rejected with a
// message naming that product, rather than letting the PRIMARY KEY throw a raw SQLite error — a
// barcode maps to exactly one product, so reassigning it must be a deliberate move off the other.
function setBarcodes(db: Database.Database, productId: number, barcodes: string[]): void {
  const ownerStmt = db.prepare(
    `SELECT p.name FROM product_barcodes b JOIN products p ON p.id = b.product_id
     WHERE b.barcode = ? AND b.product_id != ?`
  )
  for (const code of barcodes) {
    const owner = ownerStmt.get(code, productId) as { name: string } | undefined
    if (owner) throw new Error(`Barcode ${code} is already assigned to ${owner.name}`)
  }

  db.prepare('DELETE FROM product_barcodes WHERE product_id = ?').run(productId)
  const insert = db.prepare('INSERT INTO product_barcodes (barcode, product_id) VALUES (?, ?)')
  for (const code of barcodes) insert.run(code, productId)
}

export function registerProductsHandlers(db: Database.Database): void {
  ipcMain.handle('products:list', (): ProductsPayload => {
    const categories = db
      .prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order')
      .all() as CategoryRow[]
    const products = db
      .prepare(
        `SELECT id, name, category_id, sell_price_cents, cost_price_cents, stock_qty, low_stock_threshold, active,
                is_6_pack, split_target_product_id
         FROM products ORDER BY name`
      )
      .all() as ProductRow[]

    // One query for every barcode, grouped in memory — avoids a per-product lookup on a screen
    // that lists the whole catalogue.
    const codeRows = db
      .prepare('SELECT product_id, barcode FROM product_barcodes ORDER BY barcode')
      .all() as { product_id: number; barcode: string }[]
    const byProduct = new Map<number, string[]>()
    for (const { product_id, barcode } of codeRows) {
      const list = byProduct.get(product_id)
      if (list) list.push(barcode)
      else byProduct.set(product_id, [barcode])
    }

    return {
      categories: categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order })),
      products: products.map((row) => toProductDetail(row, byProduct.get(row.id) ?? []))
    }
  })

  ipcMain.handle('products:create', (_event, input: ProductCreateInput): ProductDetail => {
    if (!input.name.trim()) throw new Error('Product name is required')
    if (input.sellPriceCents <= 0) throw new Error('Sell price must be positive')
    requireManager(db, input.authorizedBy)
    const barcodes = normalizeBarcodes(input.barcodes)
    // selfId is null: a brand-new product has no id yet, so it can't reference itself.
    const splitTargetProductId = resolveSplitTarget(db, input.is6Pack, input.splitTargetProductId, null)

    const detail = db.transaction((): ProductDetail => {
      const id = Number(
        db
          .prepare(
            `INSERT INTO products
              (name, category_id, sell_price_cents, cost_price_cents, stock_qty, low_stock_threshold, active,
               is_6_pack, split_target_product_id)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
          )
          .run(
            input.name.trim(),
            input.categoryId,
            input.sellPriceCents,
            input.costPriceCents,
            input.stockQty,
            input.lowStockThreshold,
            input.is6Pack ? 1 : 0,
            splitTargetProductId
          ).lastInsertRowid
      )
      setBarcodes(db, id, barcodes)
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow
      insertOutbox(db, 'products', id, 'insert', { ...row, barcodes })
      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'product.create',
        entityType: 'product',
        entityId: id,
        details: { name: row.name, sellPriceCents: row.sell_price_cents }
      })
      return toProductDetail(row, barcodes)
    })()
    return detail
  })

  ipcMain.handle('products:update', (_event, input: ProductUpdateInput): ProductDetail => {
    if (!input.name.trim()) throw new Error('Product name is required')
    if (input.sellPriceCents <= 0) throw new Error('Sell price must be positive')
    requireManager(db, input.authorizedBy)
    const barcodes = normalizeBarcodes(input.barcodes)
    const splitTargetProductId = resolveSplitTarget(db, input.is6Pack, input.splitTargetProductId, input.id)

    const detail = db.transaction((): ProductDetail => {
      const beforeRow = db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as ProductRow | undefined
      if (!beforeRow) throw new Error('Product not found')
      const beforeBarcodes = barcodesFor(db, input.id)

      db.prepare(
        `UPDATE products
         SET name = ?, category_id = ?, sell_price_cents = ?, cost_price_cents = ?,
             low_stock_threshold = ?, active = ?, is_6_pack = ?, split_target_product_id = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        input.name.trim(),
        input.categoryId,
        input.sellPriceCents,
        input.costPriceCents,
        input.lowStockThreshold,
        input.active ? 1 : 0,
        input.is6Pack ? 1 : 0,
        splitTargetProductId,
        input.id
      )
      setBarcodes(db, input.id, barcodes)

      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as ProductRow
      insertOutbox(db, 'products', input.id, 'update', { ...row, barcodes })
      const changes = diffFields(
        toProductDetail(beforeRow, beforeBarcodes),
        toProductDetail(row, barcodes),
        [
          'name',
          'categoryId',
          'sellPriceCents',
          'costPriceCents',
          'lowStockThreshold',
          'barcodes',
          'active',
          'is6Pack',
          'splitTargetProductId'
        ]
      )
      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'product.update',
        entityType: 'product',
        entityId: input.id,
        details: { changes }
      })
      return toProductDetail(row, barcodes)
    })()
    return detail
  })

  // Hard delete. product_barcodes cascade away; sale_items, stock_moves, and combo_items are
  // RESTRICT, so any product with sales/stock/combo history throws FOREIGN KEY and is rejected with
  // a message pointing the manager at deactivate — that history must not be destroyed.
  ipcMain.handle('products:delete', (_event, input: ProductDeleteInput): void => {
    requireManager(db, input.authorizedBy)
    db.transaction((): void => {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as ProductRow | undefined
      if (!row) throw new Error('Product not found')
      try {
        db.prepare('DELETE FROM products WHERE id = ?').run(input.id)
      } catch (err) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          throw new Error('This product has sales, stock, or combo history and can’t be deleted. Deactivate it instead.')
        }
        throw err
      }
      insertOutbox(db, 'products', input.id, 'delete', { id: input.id })
      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'product.delete',
        entityType: 'product',
        entityId: input.id,
        details: { name: row.name }
      })
    })()
  })
}
