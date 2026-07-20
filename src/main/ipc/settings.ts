import { BrowserWindow, dialog, ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { SettingsPayload, SettingsUpdateInput, TestActionResult } from '@shared/types'
import { diffFields, logAudit } from '../lib/auditLog'
import { requireManager } from '../lib/requireManager'
import { runBackup } from '../lib/backup'

// Stored newline-separated in the single settings value, not a table of its own: it is a short
// list of names a manager types once, and nothing references a terminal by id.
function parseTerminals(raw: string): string[] {
  return raw
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

function readSettings(db: Database.Database): SettingsPayload {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map = new Map(rows.map((r) => [r.key, r.value]))

  return {
    businessName: map.get('business_name') ?? '',
    businessAddress: map.get('business_address') ?? '',
    businessNumber: map.get('business_number') ?? '',
    vatEnabled: map.get('vat_enabled') === 'true',
    vatRatePercent: Number(map.get('vat_rate') ?? '15'),
    vatNumber: map.get('vat_number') ?? '',
    autoLockSeconds: Number(map.get('auto_lock_seconds') ?? '90'),
    discountThresholdPercent: Number(map.get('discount_threshold_percent') ?? '20'),
    cashVarianceThresholdCents: Number(map.get('insight_cash_variance_threshold_cents') ?? '5000'),
    receiptFooter: map.get('receipt_footer') ?? '',
    printerInterface: map.get('printer_interface') ?? '',
    backupFolder: map.get('backup_folder') ?? '',
    cardTerminals: parseTerminals(map.get('card_terminals') ?? '')
  }
}

export function registerSettingsHandlers(db: Database.Database): void {
  ipcMain.handle('settings:getAll', (): SettingsPayload => readSettings(db))

  ipcMain.handle('settings:selectBackupFolder', async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('settings:backupNow', (_event, folder: string): TestActionResult => {
    try {
      runBackup(db, folder)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Backup failed' }
    }
  })

  ipcMain.handle('settings:update', (_event, input: SettingsUpdateInput): SettingsPayload => {
    requireManager(db, input.authorizedBy)
    if (!input.businessName.trim()) throw new Error('Business name is required')
    if (input.vatRatePercent < 0 || input.vatRatePercent > 100) {
      throw new Error('VAT rate must be between 0 and 100')
    }
    // Blank is legitimate (not every shop is a VAT vendor), but a number that IS entered prints on
    // every tax invoice — so reject a malformed one here rather than on 3000 receipts.
    if (input.vatNumber.trim() && !/^4\d{9}$/.test(input.vatNumber.trim())) {
      throw new Error('VAT number must be 10 digits starting with 4')
    }
    if (input.autoLockSeconds < 10) throw new Error('Auto-lock must be at least 10 seconds')
    if (input.discountThresholdPercent < 0 || input.discountThresholdPercent > 100) {
      throw new Error('Discount threshold must be between 0 and 100')
    }
    if (input.cashVarianceThresholdCents < 0) throw new Error('Cash variance threshold cannot be negative')

    const before = readSettings(db)

    const values: [string, string][] = [
      ['business_name', input.businessName.trim()],
      ['business_address', input.businessAddress.trim()],
      ['business_number', input.businessNumber.trim()],
      ['vat_enabled', input.vatEnabled ? 'true' : 'false'],
      ['vat_rate', String(input.vatRatePercent)],
      ['vat_number', input.vatNumber.trim()],
      ['auto_lock_seconds', String(input.autoLockSeconds)],
      ['discount_threshold_percent', String(input.discountThresholdPercent)],
      ['insight_cash_variance_threshold_cents', String(input.cashVarianceThresholdCents)],
      ['receipt_footer', input.receiptFooter.trim()],
      ['printer_interface', input.printerInterface.trim()],
      ['backup_folder', input.backupFolder.trim()],
      ['card_terminals', parseTerminals(input.cardTerminals.join('\n')).join('\n')]
    ]
    const upsert = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    const updateAll = db.transaction((): void => {
      for (const [key, value] of values) upsert.run(key, value)
    })
    updateAll()

    const after = readSettings(db)
    const changes = diffFields(before, after, [
      'businessName',
      'businessAddress',
      'businessNumber',
      'vatEnabled',
      'vatRatePercent',
      'vatNumber',
      'autoLockSeconds',
      'discountThresholdPercent',
      'cashVarianceThresholdCents',
      'receiptFooter',
      'printerInterface',
      'backupFolder',
      'cardTerminals'
    ])
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'settings.update',
      entityType: 'settings',
      entityId: null,
      details: { changes }
    })

    return after
  })
}
