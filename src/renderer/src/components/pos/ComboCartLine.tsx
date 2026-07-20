import { useState } from 'react'
import { formatRands } from '@shared/money'
import type { ComboLine } from '../../stores/cartStore'
import { QtyStepper } from './QtyStepper'

interface ComboCartLineProps {
  combo: ComboLine
  onChangeQty: (qty: number) => void
  onRemove: () => void
}

export function ComboCartLine({ combo, onChangeQty, onRemove }: ComboCartLineProps): React.JSX.Element {
  const [stepperOpen, setStepperOpen] = useState(false)

  return (
    <div className="rounded-xl border border-accent-border bg-accent-tint p-3">
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setStepperOpen((o) => !o)}>
          <p className="truncate text-sm font-medium text-accent-light">🎁 {combo.name}</p>
          <p className="text-xs text-ink-muted">qty {combo.qty} · tap to adjust</p>
        </button>
        <span className="shrink-0 text-sm font-semibold text-ink">{formatRands(combo.priceCents * combo.qty)}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove combo"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint"
        >
          ✕
        </button>
      </div>
      {stepperOpen && (
        <div className="mt-3">
          <QtyStepper qty={combo.qty} onChange={onChangeQty} />
        </div>
      )}
    </div>
  )
}
