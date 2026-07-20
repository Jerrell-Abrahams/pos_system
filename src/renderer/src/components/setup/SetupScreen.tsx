import { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { Keypad } from '../common/Keypad'

// Shown only on an install that has no employees at all — a packaged build seeds none, so this
// is where a real shop gets its first manager. Everything else (staff, products, VAT number,
// printer) is reachable from Settings once someone can log in, so this asks for the minimum.
export function SetupScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const loadSettings = useSettingsStore((s) => s.load)

  const [businessName, setBusinessName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage] = useState<'details' | 'pin' | 'confirm'>('details')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const detailsValid = businessName.trim().length > 0 && managerName.trim().length > 0

  function handleDigit(digit: string): void {
    setError('')
    if (stage === 'pin') {
      if (pin.length < 6) setPin(pin + digit)
    } else if (confirmPin.length < 6) {
      setConfirmPin(confirmPin + digit)
    }
  }

  function handleBackspace(): void {
    setError('')
    if (stage === 'pin') setPin((p) => p.slice(0, -1))
    else setConfirmPin((p) => p.slice(0, -1))
  }

  async function submit(): Promise<void> {
    if (pin !== confirmPin) {
      setError('PINs do not match — start again')
      setPin('')
      setConfirmPin('')
      setStage('pin')
      return
    }
    setSaving(true)
    setError('')
    try {
      await window.api.setup.createFirstManager({ businessName, managerName, pin })
      await loadSettings()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete setup')
      setSaving(false)
    }
  }

  const activePin = stage === 'confirm' ? confirmPin : pin

  return (
    <div className="flex h-full items-center justify-center bg-bg p-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold text-ink">Set up this till</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {stage === 'details'
            ? 'Tell us who this till belongs to. You can change any of it later in Settings.'
            : stage === 'pin'
              ? 'Choose a PIN for the first manager. This PIN authorizes voids, discounts and settings changes — do not share it with cashiers.'
              : 'Enter the same PIN again to confirm it.'}
        </p>

        {stage === 'details' && (
          <div className="mt-8 space-y-4">
            <div>
              <label className="text-xs text-ink-muted">Business name</label>
              <input
                type="text"
                autoFocus
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="As it should appear on receipts"
                className="mt-1 h-12 w-full rounded-xl border border-border bg-surface px-3 text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">Manager name</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Who runs this shop"
                className="mt-1 h-12 w-full rounded-xl border border-border bg-surface px-3 text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={!detailsValid}
              onClick={() => setStage('pin')}
              className="h-14 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {stage !== 'details' && (
          <div className="mt-8">
            <div className="flex justify-center gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-5 w-5 rounded-full border ${error ? 'border-danger' : 'border-accent-border'} ${
                    i < activePin.length ? (error ? 'bg-danger' : 'bg-accent') : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <div className="mt-6">
              <Keypad
                size="lg"
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onSubmit={() => {
                  if (stage === 'pin') {
                    setStage('confirm')
                  } else {
                    void submit()
                  }
                }}
                submitDisabled={activePin.length < 4 || saving}
                submitLabel={stage === 'pin' ? 'Next' : 'Finish'}
              />
            </div>
          </div>
        )}

        <p className="mt-4 min-h-6 text-center text-sm text-danger">{error}</p>
      </div>
    </div>
  )
}
