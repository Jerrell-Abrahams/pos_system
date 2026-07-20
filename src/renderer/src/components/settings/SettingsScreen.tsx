import { useEffect, useRef, useState } from 'react'
import type { SettingsPayload } from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { useLicenseStore } from '../../stores/licenseStore'
import { useNavStore, type Screen } from '../../stores/navStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useThemeStore } from '../../stores/themeStore'
import { useToastStore } from '../../stores/toastStore'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { MoneyField } from '../common/MoneyField'
import { NumberStepperField } from '../common/NumberStepperField'

export function SettingsScreen(): React.JSX.Element {
  const settings = useSettingsStore((s) => s)
  const loadSettings = useSettingsStore((s) => s.load)
  const pushToast = useToastStore((s) => s.push)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const [form, setForm] = useState<SettingsPayload | null>(null)
  const [managerAction, setManagerAction] = useState<'save' | 'logoutTenant' | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<'print' | 'drawer' | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingNav, setPendingNav] = useState<Screen | null>(null)

  // Mirrored into a ref so the nav blocker (registered once) always reads the live value instead
  // of a stale closure over `dirty`.
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Veto navigating away with unsaved edits; stash the target and let the confirm dialog re-issue
  // the nav once the manager accepts losing them.
  useEffect(() => {
    useNavStore.getState().setBlocker((target) => {
      if (!dirtyRef.current) return true
      setPendingNav(target)
      return false
    })
    return () => useNavStore.getState().setBlocker(null)
  }, [])

  useEffect(() => {
    setForm({
      businessName: settings.businessName,
      businessAddress: settings.businessAddress,
      businessNumber: settings.businessNumber,
      vatEnabled: settings.vatEnabled,
      vatRatePercent: settings.vatRatePercent,
      vatNumber: settings.vatNumber,
      autoLockSeconds: settings.autoLockSeconds,
      discountThresholdPercent: settings.discountThresholdPercent,
      cashVarianceThresholdCents: settings.cashVarianceThresholdCents,
      receiptFooter: settings.receiptFooter,
      printerInterface: settings.printerInterface,
      backupFolder: settings.backupFolder,
      cardTerminals: settings.cardTerminals
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set<K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]): void {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setDirty(true)
  }

  async function save(authorizedBy: number): Promise<void> {
    if (!form) return
    setManagerAction(null)
    setSaving(true)
    setError('')
    try {
      await window.api.settings.update({ ...form, authorizedBy })
      await loadSettings()
      setDirty(false)
      pushToast('Settings saved', 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  function discardAndLeave(): void {
    const target = pendingNav
    dirtyRef.current = false
    setDirty(false)
    setPendingNav(null)
    if (target) useNavStore.getState().setScreen(target)
  }

  async function chooseBackupFolder(): Promise<void> {
    const path = await window.api.settings.selectBackupFolder()
    if (path) set('backupFolder', path)
  }

  async function backupNow(): Promise<void> {
    if (!form) return
    setBackingUp(true)
    const result = await window.api.settings.backupNow(form.backupFolder)
    pushToast(result.ok ? 'Backup complete' : `Backup failed: ${result.error}`, result.ok ? 'info' : 'error')
    setBackingUp(false)
  }

  async function checkForUpdate(): Promise<void> {
    setCheckingUpdate(true)
    await window.api.autoUpdate.check()
    pushToast('Checking for updates in the background…', 'info')
    setCheckingUpdate(false)
  }

  async function logoutTenant(): Promise<void> {
    setManagerAction(null)
    await useLicenseStore.getState().logout()
    useAuthStore.getState().logout()
  }

  async function testPrint(): Promise<void> {
    setTesting('print')
    const result = await window.api.printer.testPrint()
    pushToast(result.ok ? 'Test receipt sent' : `Test print failed: ${result.error}`, result.ok ? 'info' : 'error')
    setTesting(null)
  }

  async function testDrawer(): Promise<void> {
    setTesting('drawer')
    const result = await window.api.printer.testDrawerKick()
    pushToast(result.ok ? 'Drawer kick sent' : `Drawer test failed: ${result.error}`, result.ok ? 'info' : 'error')
    setTesting(null)
  }

  if (!form) {
    return <div className="p-4 text-sm text-ink-muted">Loading…</div>
  }

  if (managerAction) {
    return (
      <div className="flex h-full items-center justify-center">
        <ManagerPinModal
          title="Manager approval required"
          message={
            managerAction === 'save'
              ? 'Saving settings needs a manager PIN.'
              : 'Logging out this tenant needs a manager PIN. The device will return to the activation screen.'
          }
          onAuthorized={(managerId) =>
            void (managerAction === 'save' ? save(managerId) : logoutTenant())
          }
          onCancel={() => setManagerAction(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-6">
          <Section title="Display">
            <Toggle label="Light mode" checked={theme === 'light'} onChange={(v) => setTheme(v ? 'light' : 'dark')} />
          </Section>

          <Section title="Business">
            <TextField label="Business name" value={form.businessName} onChange={(v) => set('businessName', v)} />
            <TextField label="Address" value={form.businessAddress} onChange={(v) => set('businessAddress', v)} />
            <TextField
              label="Business number"
              value={form.businessNumber}
              onChange={(v) => set('businessNumber', v)}
              placeholder="Prints on the receipt (leave blank to hide)"
            />
            <TextField label="Receipt footer" value={form.receiptFooter} onChange={(v) => set('receiptFooter', v)} />
          </Section>

          <Section title="VAT">
            <Toggle label="VAT enabled" checked={form.vatEnabled} onChange={(v) => set('vatEnabled', v)} />
            <NumberStepperField
              label="VAT rate %"
              value={form.vatRatePercent}
              onChange={(v) => set('vatRatePercent', v)}
              min={0}
              max={100}
            />
            <TextField
              label="VAT number"
              value={form.vatNumber}
              onChange={(v) => set('vatNumber', v)}
              placeholder="4123456789 (leave blank if not VAT registered)"
            />
            <p className="text-xs text-ink-muted">
              Receipts only print as a TAX INVOICE once this is filled in.
            </p>
          </Section>

          <Section title="Till & Security">
            <NumberStepperField
              label="Auto-lock after (seconds)"
              value={form.autoLockSeconds}
              onChange={(v) => set('autoLockSeconds', v)}
              min={10}
              max={3600}
              step={5}
            />
            <NumberStepperField
              label="Manager approval above discount %"
              value={form.discountThresholdPercent}
              onChange={(v) => set('discountThresholdPercent', v)}
              min={0}
              max={100}
            />
            <MoneyField
              label="Flag cash variance over"
              cents={form.cashVarianceThresholdCents}
              onChange={(v) => set('cashVarianceThresholdCents', v)}
            />
            <p className="text-xs text-ink-muted">
              The dashboard warns when a till closes over or short by more than this.
            </p>
          </Section>

          <Section title="Card Machines">
            <div>
              <label className="text-xs text-ink-muted">Speedpoints, one per line</label>
              <textarea
                value={form.cardTerminals.join('\n')}
                onChange={(e) => set('cardTerminals', e.target.value.split('\n'))}
                rows={4}
                placeholder={'Capitec NEW9220\nT650p Petro Verifone\nShop2Shop'}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-ink outline-none focus:border-accent-border"
              />
            </div>
            <p className="text-xs text-ink-muted">
              Listed here, the cashier picks which machine took each card payment, and it shows on the receipt and
              in Sales History. Leave blank to skip the picker.
            </p>
          </Section>

          <Section title="Receipt Printer">
            <TextField
              label="Printer interface"
              value={form.printerInterface}
              onChange={(v) => set('printerInterface', v)}
              placeholder="tcp://192.168.1.50:9100 (leave blank if none)"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void testPrint()}
                disabled={testing !== null}
                className="h-12 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint disabled:opacity-40"
              >
                {testing === 'print' ? 'Testing…' : 'Test Print'}
              </button>
              <button
                type="button"
                onClick={() => void testDrawer()}
                disabled={testing !== null}
                className="h-12 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint disabled:opacity-40"
              >
                {testing === 'drawer' ? 'Testing…' : 'Test Drawer'}
              </button>
            </div>
          </Section>

          <Section title="Backups">
            <TextField
              label="Backup folder"
              value={form.backupFolder}
              onChange={(v) => set('backupFolder', v)}
              placeholder="Leave blank to use the default app data folder"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void chooseBackupFolder()}
                className="h-12 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
              >
                Choose Folder…
              </button>
              <button
                type="button"
                onClick={() => void backupNow()}
                disabled={!form.backupFolder || backingUp}
                className="h-12 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint disabled:opacity-40"
              >
                {backingUp ? 'Backing up…' : 'Backup Now'}
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              The till keeps a local safety copy every 6 hours. Point this at a USB or network
              drive to also keep an offsite copy, updated once a month.
            </p>
          </Section>

          <Section title="Software Update">
            <button
              type="button"
              onClick={() => void checkForUpdate()}
              disabled={checkingUpdate}
              className="h-12 w-full rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint disabled:opacity-40"
            >
              {checkingUpdate ? 'Checking…' : 'Check for Update'}
            </button>
          </Section>

          <Section title="Tenant">
            <button
              type="button"
              onClick={() => setManagerAction('logoutTenant')}
              className="h-12 w-full rounded-xl border border-danger/40 text-sm font-medium text-danger active:bg-danger/10"
            >
              Log out tenant
            </button>
          </Section>

          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </div>
      </div>

      <div className="mx-auto mt-3 w-full max-w-xl">
        <button
          type="button"
          disabled={saving}
          onClick={() => setManagerAction('save')}
          className="h-14 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light disabled:opacity-40"
        >
          {saving ? 'Saving…' : dirty ? 'Save Settings •' : 'Save Settings'}
        </button>
      </div>

      {pendingNav && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You have unsaved settings changes. Leaving now will discard them."
          confirmLabel="Discard"
          onConfirm={discardAndLeave}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface p-4">{children}</div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}): React.JSX.Element {
  return (
    <div>
      <label className="text-xs text-ink-muted">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
      />
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex h-12 w-full items-center justify-between rounded-xl border px-3 text-sm font-medium ${
        checked ? 'border-accent-border bg-accent-tint text-accent-light' : 'border-border text-ink-muted'
      }`}
    >
      <span>{label}</span>
      <span>{checked ? 'On' : 'Off'}</span>
    </button>
  )
}
