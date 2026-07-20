import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { CatalogPayload } from '@shared/types'

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
}
