import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { CatalogPayload, Category, CategoryCreateInput, CategoryDeleteInput } from '@shared/types'
import { logAudit } from '../lib/auditLog'
import { insertOutbox } from '../lib/outbox'
import { requireManager } from '../lib/requireManager'

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
  stock_qty: number
}

export function registerCatalogHandlers(db: Database.Database): void {
  ipcMain.handle('catalog:list', (): CatalogPayload => {
    const categories = db
      .prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order')
      .all() as CategoryRow[]

    const products = db
      .prepare(
        `SELECT id, name, category_id, sell_price_cents, stock_qty
         FROM products WHERE active = 1 ORDER BY name`
      )
      .all() as ProductRow[]

    // Only active products are scannable, so join to skip barcodes of deactivated ones.
    const codeRows = db
      .prepare(
        `SELECT b.product_id, b.barcode FROM product_barcodes b
         JOIN products p ON p.id = b.product_id WHERE p.active = 1 ORDER BY b.barcode`
      )
      .all() as { product_id: number; barcode: string }[]
    const byProduct = new Map<number, string[]>()
    for (const { product_id, barcode } of codeRows) {
      const list = byProduct.get(product_id)
      if (list) list.push(barcode)
      else byProduct.set(product_id, [barcode])
    }

    return {
      categories: categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.category_id,
        sellPriceCents: p.sell_price_cents,
        stockQty: p.stock_qty,
        barcodes: byProduct.get(p.id) ?? []
      }))
    }
  })

  // Catalog mutations are manager-gated exactly like products — the renderer collects a manager PIN
  // (ManagerPinModal) and passes the verified id as authorizedBy.
  ipcMain.handle('catalog:createCategory', (_event, input: CategoryCreateInput): Category => {
    const name = input.name.trim()
    if (!name) throw new Error('Category name is required')
    requireManager(db, input.authorizedBy)
    // No UNIQUE on categories.name, so guard here — two "Spirits" tabs help nobody.
    if (db.prepare('SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE').get(name)) {
      throw new Error(`A category named “${name}” already exists`)
    }

    return db.transaction((): Category => {
      const sortOrder = (
        db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories').get() as { n: number }
      ).n
      const id = Number(
        db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder).lastInsertRowid
      )
      const row = db.prepare('SELECT id, name, sort_order FROM categories WHERE id = ?').get(id) as CategoryRow
      insertOutbox(db, 'categories', id, 'insert', row)
      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'category.create',
        entityType: 'category',
        entityId: id,
        details: { name }
      })
      return { id: row.id, name: row.name, sortOrder: row.sort_order }
    })()
  })

  // products.category_id has no ON DELETE clause, so with foreign_keys ON, SQLite blocks removing a
  // category that still has products. Translate that into a message pointing the manager at the fix
  // rather than silently re-bucketing their catalogue.
  ipcMain.handle('catalog:deleteCategory', (_event, input: CategoryDeleteInput): void => {
    requireManager(db, input.authorizedBy)
    db.transaction((): void => {
      const row = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(input.id) as
        | { id: number; name: string }
        | undefined
      if (!row) throw new Error('Category not found')
      try {
        db.prepare('DELETE FROM categories WHERE id = ?').run(input.id)
      } catch (err) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          throw new Error('Products are still in this category. Move them to another category first.')
        }
        throw err
      }
      insertOutbox(db, 'categories', input.id, 'delete', { id: input.id })
      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'category.delete',
        entityType: 'category',
        entityId: input.id,
        details: { name: row.name }
      })
    })()
  })
}
