import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { pruneOldBackups, runBackup } from './backup'
import { createTestDb, insertProduct } from '../testUtils'

let dir: string | null = null

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

describe('runBackup', () => {
  it('writes a self-contained, restorable copy of the database into the backup folder', () => {
    dir = mkdtempSync(join(tmpdir(), 'pos-backup-test-'))
    const db = createTestDb()
    db.prepare(`INSERT INTO settings (key, value) VALUES ('backup_folder', ?)`).run(dir)
    insertProduct(db, { name: 'Castle Lager 340ml' })

    runBackup(db)

    const files = readdirSync(dir).filter((f) => f.startsWith('pos-backup-'))
    expect(files).toHaveLength(1)

    const restored = new Database(join(dir, files[0]), { readonly: true })
    const row = restored.prepare('SELECT name FROM products').get() as { name: string }
    expect(row.name).toBe('Castle Lager 340ml')
    restored.close()
  })
})

describe('pruneOldBackups', () => {
  it('keeps only the 14 most recent backups', () => {
    dir = mkdtempSync(join(tmpdir(), 'pos-backup-test-'))
    for (let i = 0; i < 20; i++) {
      const name = `pos-backup-${i}.db`
      writeFileSync(join(dir, name), '')
      utimesSync(join(dir, name), new Date(i * 1000), new Date(i * 1000))
    }

    pruneOldBackups(dir)

    const remaining = readdirSync(dir).sort()
    expect(remaining).toHaveLength(14)
    expect(remaining).toEqual(
      Array.from({ length: 14 }, (_, i) => `pos-backup-${i + 6}.db`).sort()
    )
  })
})
