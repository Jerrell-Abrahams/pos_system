import { useState } from 'react'
import { formatRands } from '@shared/money'
import { Keypad } from './Keypad'

interface MoneyFieldProps {
  label: string
  cents: number
  onChange: (cents: number) => void
}

const MAX_CENTS = 99999900

export function MoneyField({ label, cents, onChange }: MoneyFieldProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(0)

  function open(): void {
    setDraft(cents)
    setEditing(true)
  }

  function handleDigit(digit: string): void {
    setDraft((v) => Math.min(v * 10 + Number(digit), MAX_CENTS))
  }

  function handleBackspace(): void {
    setDraft((v) => Math.floor(v / 10))
  }

  function submit(): void {
    onChange(draft)
    setEditing(false)
  }

  return (
    <div>
      <label className="text-xs text-ink-muted">{label}</label>
      <button
        type="button"
        onClick={open}
        className="mt-1 h-14 w-full rounded-xl border border-border bg-bg px-4 text-left text-lg font-medium text-ink active:border-accent-border"
      >
        {formatRands(cents)}
      </button>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-center text-sm font-medium text-ink-muted">{label}</h2>
            <p className="mt-1 text-center text-3xl font-semibold text-ink">{formatRands(draft)}</p>
            <div className="mt-4">
              <Keypad onDigit={handleDigit} onBackspace={handleBackspace} onSubmit={submit} submitLabel="Set" />
            </div>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
