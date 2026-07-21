import { useState } from 'react'
import { Keypad } from './Keypad'
import { ModalBackdrop } from './ModalBackdrop'

interface ManagerPinModalProps {
  title?: string
  message?: string
  onAuthorized: (managerId: number) => void
  onCancel: () => void
}

export function ManagerPinModal({
  title = 'Manager approval required',
  message,
  onAuthorized,
  onCancel
}: ManagerPinModalProps): React.JSX.Element {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Deliberately calls the raw IPC login check (not the authStore action) so verifying a
  // manager PIN never overwrites the cashier's active session.
  async function submit(value: string): Promise<void> {
    if (value.length < 4 || submitting) return
    setSubmitting(true)
    const result = await window.api.auth.login(value)
    setSubmitting(false)
    if (result.ok && result.employee?.role === 'manager') {
      onAuthorized(result.employee.id)
      return
    }
    setError(result.ok ? 'That PIN is not a manager PIN' : 'Incorrect PIN')
    setPin('')
  }

  function handleDigit(digit: string): void {
    if (pin.length >= 6 || submitting) return
    const next = pin + digit
    setError('')
    setPin(next)
    if (next.length === 6) void submit(next)
  }

  function handleBackspace(): void {
    setError('')
    setPin((p) => p.slice(0, -1))
  }

  return (
    <ModalBackdrop onClose={onCancel} className="p-4">
      <div className="max-h-[90vh] w-full max-w-80 overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-center">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {message && <p className="mt-1 text-sm text-ink-muted">{message}</p>}
        <div className="mt-4 flex justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border border-accent-border ${
                i < pin.length ? 'bg-accent' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 h-5 text-sm text-danger">{error}</p>
        <div className="mt-4">
          <Keypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={() => void submit(pin)}
            submitDisabled={pin.length < 4 || submitting}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
        >
          Cancel
        </button>
      </div>
    </ModalBackdrop>
  )
}
