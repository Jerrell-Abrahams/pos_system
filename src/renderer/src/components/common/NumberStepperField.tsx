import { useState } from 'react'
import { Keypad } from './Keypad'

interface NumberStepperFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}

const DEFAULT_MAX = 99999

export function NumberStepperField({
  label,
  value,
  onChange,
  min = 0,
  max = DEFAULT_MAX,
  step = 1
}: NumberStepperFieldProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(0)

  function open(): void {
    setDraft(value)
    setEditing(true)
  }

  function handleDigit(digit: string): void {
    setDraft((v) => Math.min(v * 10 + Number(digit), max))
  }

  function handleBackspace(): void {
    setDraft((v) => Math.floor(v / 10))
  }

  function submit(): void {
    onChange(Math.min(max, Math.max(min, draft)))
    setEditing(false)
  }

  return (
    <div>
      <label className="text-xs text-ink-muted">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-xl text-ink active:bg-accent-tint"
        >
          −
        </button>
        <button
          type="button"
          onClick={open}
          className="h-12 flex-1 rounded-xl border border-border bg-bg text-center text-ink focus:border-accent-border focus:outline-none"
        >
          {value}
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-xl text-ink active:bg-accent-tint"
        >
          +
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-center text-sm font-medium text-ink-muted">{label}</h2>
            <p className="mt-1 text-center text-3xl font-semibold text-ink">{draft}</p>
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
