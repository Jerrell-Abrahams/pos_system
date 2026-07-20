import { describe, expect, it } from 'vitest'
import { createTestDb, insertProduct } from '../testUtils'

// Guards the guarantee catalog:deleteCategory leans on: an empty category deletes, but the FK on
// products.category_id blocks removing one that still has products (the handler turns that throw into
// a "move them first" message). If a migration ever added ON DELETE SET NULL/CASCADE here, the second
// case would stop throwing and this test would catch the silent re-bucketing.
describe('category delete FK behaviour', () => {
  it('deletes an empty category', () => {
    const db = createTestDb()
    const id = Number(db.prepare("INSERT INTO categories (name, sort_order) VALUES ('Empty', 0)").run().lastInsertRowid)

    db.prepare('DELETE FROM categories WHERE id = ?').run(id)

    expect(db.prepare('SELECT id FROM categories WHERE id = ?').get(id)).toBeUndefined()
  })

  it('refuses to delete a category that still has products', () => {
    const db = createTestDb()
    const id = Number(db.prepare("INSERT INTO categories (name, sort_order) VALUES ('Spirits', 0)").run().lastInsertRowid)
    const productId = insertProduct(db)
    db.prepare('UPDATE products SET category_id = ? WHERE id = ?').run(id, productId)

    expect(() => db.prepare('DELETE FROM categories WHERE id = ?').run(id)).toThrow(/FOREIGN KEY constraint failed/)
  })
})
