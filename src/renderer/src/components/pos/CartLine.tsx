import { useState } from 'react'
import { formatRands } from '@shared/money'
import type { CartLine as CartLineType } from '../../stores/cartStore'
import { QtyStepper } from './QtyStepper'

interface CartLineProps {
  line: CartLineType
  onChangeQty: (qty: number) => void
  onRemove: () => void
}

export function CartLine({ line, onChangeQty, onRemove }: CartLineProps): React.JSX.Element {
  const [stepperOpen, setStepperOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg">
          {line.qty}
        </div>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setStepperOpen((o) => !o)}
        >
          <p className={`text-sm font-semibold text-ink ${stepperOpen ? '' : 'truncate'}`}>{line.name}</p>
          <p className="text-xs text-ink-muted">
            <span className="font-semibold">{formatRands(line.unitPriceCents * line.qty)}</span> · tap to adjust
          </p>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove line"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint"
        >
          ✕
        </button>
      </div>
      {stepperOpen && (
        <div className="mt-3">
          <QtyStepper qty={line.qty} onChange={onChangeQty} />
        </div>
      )}
    </div>
  )
}
