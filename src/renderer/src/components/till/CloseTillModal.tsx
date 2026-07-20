import { useEffect, useState } from 'react'
import { formatRands } from '@shared/money'
import type { OpenTillInfo, TillCloseResult } from '@shared/types'
import { useTillStore } from '../../stores/tillStore'
import { Keypad } from '../common/Keypad'
import { ManagerPinModal } from '../common/ManagerPinModal'

interface CloseTillModalProps {
  onClose: () => void
}

const MAX_CENTS = 99999900

export function CloseTillModal({ onClose }: CloseTillModalProps): React.JSX.Element {
  const closeTill = useTillStore((s) => s.close)
  const [till, setTill] = useState<OpenTillInfo | null>(null)
  const [cents, setCents] = useState(0)
  const [showManagerGate, setShowManagerGate] = useState(false)
  const [result, setResult] = useState<TillCloseResult | null>(null)
  const [error, setError] = useState('')

  // Fetched fresh on open (not read from the till store) so "expected cash" reflects every
  // sale rung up during the shift, not whatever was cached when the till was opened.
  useEffect(() => {
    void window.api.till.status().then((s) => setTill(s.till))
  }, [])

  function handleDigit(digit: string): void {
    setCents((v) => Math.min(v * 10 + Number(digit), MAX_CENTS))
  }

  function handleBackspace(): void {
    setCents((v) => Math.floor(v / 10))
  }

  async function confirmClose(managerId: number): Promise<void> {
    setShowManagerGate(false)
    try {
      const res = await closeTill(managerId, cents)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close till')
    }
  }

  if (showManagerGate) {
    return (
      <ManagerPinModal
        title="Manager approval required"
        message="Closing the till needs a manager PIN."
        onAuthorized={(managerId) => void confirmClose(managerId)}
        onCancel={() => setShowManagerGate(false)}
      />
    )
  }

  if (result) {
    const diff = result.differenceCents
    return (
      <Frame>
        <h2 className="text-center text-lg font-semibold text-ink">Till closed</h2>
        <div className="mt-4 space-y-1 text-sm">
          <Row label="Expected cash" value={formatRands(result.expectedCashCents)} />
          <Row label="Counted cash" value={formatRands(result.closingCashCents)} />
          <div className={`flex justify-between text-lg font-semibold ${diff === 0 ? 'text-success' : 'text-danger'}`}>
            <span>{diff === 0 ? 'Balanced' : diff > 0 ? 'Over' : 'Short'}</span>
            <span>{formatRands(Math.abs(diff))}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-16 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light"
        >
          Done
        </button>
      </Frame>
    )
  }

  return (
    <Frame>
      <h2 className="text-center text-lg font-semibold text-ink">Close Till</h2>
      <p className="mt-1 text-center text-sm text-ink-muted">
        {till
          ? `Opened ${formatRands(till.openingCashCents)} · expect ${formatRands(till.expectedCashCents)} in the drawer now.`
          : 'Loading till…'}
      </p>

      <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-center">
        <p className="text-xs text-ink-muted">Counted cash</p>
        <p className="text-3xl font-semibold text-ink">{formatRands(cents)}</p>
      </div>

      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

      <div className="mt-4">
        <Keypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onSubmit={() => setShowManagerGate(true)}
          submitLabel="Close Till"
          submitDisabled={!till}
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
      >
        Cancel
      </button>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-96 overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between text-ink-muted">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
