import { useState } from 'react'
import { Keypad } from './Keypad'

interface PinFieldProps {
  label: string
  hint: string
  hasValue: boolean
  onChange: (pin: string) => void
}

export function PinField({ label, hint, hasValue, onChange }: PinFieldProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function open(): void {
    setDraft('')
    setEditing(true)
  }

  function handleDigit(digit: string): void {
    setDraft((v) => (v.length >= 6 ? v : v + digit))
  }

  function handleBackspace(): void {
    setDraft((v) => v.slice(0, -1))
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
        {hasValue ? '••••••' : hint}
      </button>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-center text-sm font-medium text-ink-muted">{label}</h2>
            <div className="mt-3 flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 rounded-full border border-accent-border ${
                    i < draft.length ? 'bg-accent' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <div className="mt-4">
              <Keypad
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onSubmit={submit}
                submitLabel="Set"
                submitDisabled={draft.length < 4}
              />
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
