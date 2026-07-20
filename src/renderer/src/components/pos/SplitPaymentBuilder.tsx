import { useState } from 'react'
import { calcChangeCents, calcPaymentsCoveredCents, calcRemainingCents, formatRands } from '@shared/money'
import type { PaymentInput, PaymentMethod } from '@shared/types'
import { useSettingsStore } from '../../stores/settingsStore'
import { Keypad } from '../common/Keypad'

interface SplitPaymentBuilderProps {
  totalCents: number
  onComplete: (payments: PaymentInput[]) => void
  onCancel: () => void
}

const MAX_AMOUNT_CENTS = 9999900
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', card: 'Card', eft: 'EFT' }

export function SplitPaymentBuilder({ totalCents, onComplete, onCancel }: SplitPaymentBuilderProps): React.JSX.Element {
  const cardTerminals = useSettingsStore((s) => s.cardTerminals)
  const [lines, setLines] = useState<PaymentInput[]>([])
  const [pickingMethod, setPickingMethod] = useState<PaymentMethod | null>(null)
  const [terminal, setTerminal] = useState<string | null>(null)
  const [amountCents, setAmountCents] = useState(0)

  const remainingCents = calcRemainingCents(totalCents, lines)
  const coveredCents = calcPaymentsCoveredCents(lines)

  function startMethod(method: PaymentMethod): void {
    setPickingMethod(method)
    setTerminal(null)
    setAmountCents(0)
  }

  function handleDigit(digit: string): void {
    setAmountCents((v) => Math.min(v * 10 + Number(digit), MAX_AMOUNT_CENTS))
  }

  function handleBackspace(): void {
    setAmountCents((v) => Math.floor(v / 10))
  }

  function addLine(): void {
    if (!pickingMethod || amountCents <= 0) return
    const appliedCents = Math.min(amountCents, remainingCents)
    if (pickingMethod === 'cash') {
      const changeCents = calcChangeCents(amountCents, appliedCents)
      setLines((l) => [...l, { method: 'cash', amountCents: appliedCents, tenderedCents: amountCents, changeCents }])
    } else {
      setLines((l) => [...l, { method: pickingMethod, amountCents: appliedCents, terminal: terminal ?? undefined }])
    }
    setPickingMethod(null)
    setTerminal(null)
    setAmountCents(0)
  }

  function removeLine(index: number): void {
    setLines((l) => l.filter((_, i) => i !== index))
  }

  if (pickingMethod === 'card' && cardTerminals.length > 0 && !terminal) {
    return (
      <div>
        <p className="text-center text-sm text-ink-muted">Which card machine?</p>
        <div className="mt-3 space-y-2">
          {cardTerminals.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTerminal(t)}
              className="h-14 w-full rounded-xl border border-border bg-bg px-4 text-base font-medium text-ink active:border-accent-border active:bg-accent-tint"
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPickingMethod(null)}
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
        >
          Back
        </button>
      </div>
    )
  }

  if (pickingMethod) {
    return (
      <div>
        <p className="text-center text-sm text-ink-muted">Remaining due</p>
        <p className="text-center text-3xl font-semibold text-ink">{formatRands(remainingCents)}</p>

        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-center">
          <p className="text-xs text-ink-muted">
            {pickingMethod === 'cash' ? 'Tendered' : `Amount on ${terminal ?? METHOD_LABEL[pickingMethod]}`}
          </p>
          <p className="text-2xl font-medium text-ink">{formatRands(amountCents)}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAmountCents(remainingCents)}
            className="h-12 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Full amount
          </button>
          <button
            type="button"
            onClick={() => setPickingMethod(null)}
            className="h-12 rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
          >
            Back
          </button>
        </div>

        <div className="mt-3">
          <Keypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={addLine}
            submitLabel="Add"
            submitDisabled={amountCents <= 0}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-center text-sm text-ink-muted">Remaining due</p>
      <p className="text-center text-3xl font-semibold text-ink">{formatRands(Math.max(remainingCents, 0))}</p>

      {lines.length > 0 && (
        <div className="mt-4 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2">
              <span className="text-sm text-ink">{line.terminal ?? METHOD_LABEL[line.method]}</span>
              <span className="text-sm font-medium text-ink">{formatRands(line.amountCents)}</span>
              <button
                type="button"
                onClick={() => removeLine(i)}
                aria-label="Remove payment line"
                className="flex h-8 w-8 items-center justify-center text-ink-muted active:bg-accent-tint"
              >
                ✕
              </button>
            </div>
          ))}
          <p className="text-right text-xs text-ink-muted">Covered {formatRands(coveredCents)}</p>
        </div>
      )}

      {remainingCents > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => startMethod('cash')}
            className="h-16 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Cash
          </button>
          <button
            type="button"
            onClick={() => startMethod('card')}
            className="h-16 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Card
          </button>
          <button
            type="button"
            onClick={() => startMethod('eft')}
            className="h-16 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            EFT
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onComplete(lines)}
          className="mt-4 h-16 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light"
        >
          Complete Sale
        </button>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
      >
        Cancel
      </button>
    </div>
  )
}
