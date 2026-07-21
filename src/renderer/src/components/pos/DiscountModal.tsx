import { useState } from 'react'
import { calcDiscountCents, discountExceedsThreshold, formatRands } from '@shared/money'
import type { CartDiscount } from '../../stores/cartStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Keypad } from '../common/Keypad'
import { ManagerPinModal } from '../common/ManagerPinModal'

interface DiscountModalProps {
  subtotalCents: number
  current: CartDiscount | null
  onApply: (discount: CartDiscount) => void
  onRemove: () => void
  onClose: () => void
}

const MAX_FIXED_DISCOUNT_CENTS = 9999900
const MAX_PERCENT = 100
const QUICK_FIXED_RANDS = [2, 4, 6, 8, 10]

export function DiscountModal({
  subtotalCents,
  current,
  onApply,
  onRemove,
  onClose
}: DiscountModalProps): React.JSX.Element {
  const discountThresholdPercent = useSettingsStore((s) => s.discountThresholdPercent)
  const [type, setType] = useState<'fixed' | 'percent'>(current?.type ?? 'fixed')
  const [value, setValue] = useState(current?.value ?? 0)
  const [showManagerGate, setShowManagerGate] = useState(false)

  const previewCents = calcDiscountCents(subtotalCents, { type, value })
  const exceedsThreshold = discountExceedsThreshold(previewCents, subtotalCents, discountThresholdPercent)

  function selectType(next: 'fixed' | 'percent'): void {
    setType(next)
    setValue(0)
  }

  function handleDigit(digit: string): void {
    const cap = type === 'fixed' ? MAX_FIXED_DISCOUNT_CENTS : MAX_PERCENT
    setValue((v) => Math.min(v * 10 + Number(digit), cap))
  }

  function handleBackspace(): void {
    setValue((v) => Math.floor(v / 10))
  }

  function apply(authorizedBy: number | null): void {
    onApply({ type, value, authorizedBy })
  }

  function handleApplyClick(): void {
    if (value <= 0) return
    if (exceedsThreshold) {
      setShowManagerGate(true)
      return
    }
    apply(null)
  }

  if (showManagerGate) {
    return (
      <ManagerPinModal
        title="Discount needs manager approval"
        message={`This discount is ${formatRands(previewCents)} — over the ${discountThresholdPercent}% threshold.`}
        onAuthorized={(managerId) => apply(managerId)}
        onCancel={() => setShowManagerGate(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-96 overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">Discount</h2>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => selectType('percent')}
            className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
              type === 'percent' ? 'border-accent-border bg-accent-tint text-accent-light' : 'border-border text-ink-muted'
            }`}
          >
            Percent %
          </button>
          <button
            type="button"
            onClick={() => selectType('fixed')}
            className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
              type === 'fixed' ? 'border-accent-border bg-accent-tint text-accent-light' : 'border-border text-ink-muted'
            }`}
          >
            Fixed R
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-center">
          <p className="text-3xl font-semibold text-ink">{type === 'percent' ? `${value}%` : formatRands(value)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            −{formatRands(previewCents)} off · new total {formatRands(subtotalCents - previewCents)}
          </p>
          {exceedsThreshold && (
            <p className="mt-1 text-sm text-danger">Over {discountThresholdPercent}% — needs manager approval</p>
          )}
        </div>

        {type === 'fixed' && (
          <div className="mt-4 flex gap-2">
            {QUICK_FIXED_RANDS.map((rand) => (
              <button
                key={rand}
                type="button"
                onClick={() => setValue(rand * 100)}
                className="h-10 flex-1 rounded-xl border border-border text-sm font-medium text-ink-muted active:bg-accent-tint"
              >
                R{rand}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Keypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={handleApplyClick}
            submitLabel="Apply"
            submitDisabled={value <= 0}
          />
        </div>

        <div className="mt-3 flex gap-2">
          {current && (
            <button
              type="button"
              onClick={onRemove}
              className="h-12 flex-1 rounded-xl border border-danger text-sm font-medium text-danger active:bg-danger/10"
            >
              Remove discount
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
