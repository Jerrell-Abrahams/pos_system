import { app } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type Database from 'better-sqlite3'

const SUPABASE_BUCKET = 'backups'
// Admin-only, not exposed in Settings -- baked into the bundle at build time the same way
// LICENSE_API_URL is (see the `define` block in electron.vite.config.ts). Unset means the
// monthly Supabase upload silently no-ops; unlike licensing, this is optional.
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

const BACKUP_PREFIX = 'pos-backup-'
const KEEP_LAST = 14
export const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000
export const USB_BACKUP_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

function defaultBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

function customBackupDir(db: Database.Database): string | null {
  const custom = getSetting(db, 'backup_folder')
  return custom && custom.trim() ? custom.trim() : null
}

// VACUUM INTO writes a fresh, internally-consistent copy in one step -- safe to run against a
// live WAL-mode database without stopping writers, unlike a raw file copy of pos.db.
function backupInto(db: Database.Database, dir: string): void {
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = join(dir, `${BACKUP_PREFIX}${stamp}.db`)
  db.prepare('VACUUM INTO ?').run(dest)
  pruneOldBackups(dir)
}

// Manual "Backup Now": backs up to the given folder (e.g. the unsaved value currently shown in
// the settings form), falling back to the saved setting, then the default local folder.
export function runBackup(db: Database.Database, folderOverride?: string): void {
  const dir = folderOverride?.trim() ? folderOverride.trim() : customBackupDir(db) ?? defaultBackupDir()
  backupInto(db, dir)
}

// Scheduled local safety copy -- always runs every BACKUP_INTERVAL_MS regardless of the
// custom folder setting.
function runLocalBackup(db: Database.Database): void {
  backupInto(db, defaultBackupDir())
}

// Scheduled copy to the custom folder (e.g. a USB drive) -- only once a month, since it's
// meant as an occasional offsite copy rather than a frequent local safety net.
function runUsbBackupIfDue(db: Database.Database): void {
  const dir = customBackupDir(db)
  if (!dir) return
  const last = Number(getSetting(db, 'last_usb_backup_at') ?? '0')
  if (Date.now() - last < USB_BACKUP_INTERVAL_MS) return
  backupInto(db, dir)
  setSetting(db, 'last_usb_backup_at', String(Date.now()))
}

// Scheduled copy of the whole DB file into a Supabase Storage bucket -- same monthly cadence
// as the USB copy, since it's meant as an occasional offsite copy, not a frequent one. No-ops
// silently if SUPABASE_URL/SUPABASE_SERVICE_KEY weren't set at build time.
async function runSupabaseBackupIfDue(db: Database.Database): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return
  const last = Number(getSetting(db, 'last_supabase_backup_at') ?? '0')
  if (Date.now() - last < USB_BACKUP_INTERVAL_MS) return

  const stamp = new Date().toISOString().slice(0, 7) // YYYY-MM -- one object per calendar month
  const tmpDir = mkdtempSync(join(tmpdir(), 'pos-supabase-'))
  try {
    const dest = join(tmpDir, 'backup.db')
    db.prepare('VACUUM INTO ?').run(dest)
    const bytes = readFileSync(dest)
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${BACKUP_PREFIX}${stamp}.db`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: bytes
    })
    if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`)
    setSetting(db, 'last_supabase_backup_at', String(Date.now()))
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

export function pruneOldBackups(dir: string): void {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_PREFIX))
    .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  for (const { name } of files.slice(KEEP_LAST)) {
    unlinkSync(join(dir, name))
  }
}

export function startBackupSchedule(db: Database.Database): void {
  const attempt = async (): Promise<void> => {
    try {
      runLocalBackup(db)
    } catch (err) {
      console.error('[backup]', err instanceof Error ? err.message : err)
    }
    try {
      // custom folder may be an unplugged USB drive -- don't let a missed backup crash the till
      runUsbBackupIfDue(db)
    } catch (err) {
      console.error('[backup]', err instanceof Error ? err.message : err)
    }
    try {
      // till may be offline -- don't let a missed upload crash it either
      await runSupabaseBackupIfDue(db)
    } catch (err) {
      console.error('[backup]', err instanceof Error ? err.message : err)
    }
  }
  void attempt()
  setInterval(() => void attempt(), BACKUP_INTERVAL_MS)
}
