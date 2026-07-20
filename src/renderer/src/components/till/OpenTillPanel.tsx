import { useState } from 'react'
import { formatRands } from '@shared/money'
import { useAuthStore } from '../../stores/authStore'
import { useTillStore } from '../../stores/tillStore'
import { Keypad } from '../common/Keypad'

const QUICK_AMOUNTS_CENTS = [0, 50000, 100000]
const MAX_CENTS = 99999900

export function OpenTillPanel(): React.JSX.Element {
  const employee = useAuthStore((s) => s.employee)
  const open = useTillStore((s) => s.open)
  const [cents, setCents] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleDigit(digit: string): void {
    setCents((v) => Math.min(v * 10 + Number(digit), MAX_CENTS))
  }

  function handleBackspace(): void {
    setCents((v) => Math.floor(v / 10))
  }

  async function submit(): Promise<void> {
    if (!employee || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await open(employee.id, cents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open till')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-96 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">Open Till</h2>
        <p className="mt-1 text-center text-sm text-ink-muted">Count the float in the drawer to start the shift.</p>

        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-center">
          <p className="text-xs text-ink-muted">Opening float</p>
          <p className="text-3xl font-semibold text-ink">{formatRands(cents)}</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS_CENTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setCents(amount)}
              className="h-14 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
            >
              {formatRands(amount)}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <div className="mt-4">
          <Keypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={() => void submit()}
            submitLabel={submitting ? 'Opening…' : 'Open Till'}
            submitDisabled={submitting}
          />
        </div>
      </div>
    </div>
  )
}
