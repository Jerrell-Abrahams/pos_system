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
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setStepperOpen((o) => !o)}>
          <p className="truncate text-sm font-medium text-ink">{line.name}</p>
          <p className="text-xs text-ink-muted">qty {line.qty} · tap to adjust</p>
        </button>
        <span className="shrink-0 text-sm font-semibold text-ink">
          {formatRands(line.unitPriceCents * line.qty)}
        </span>
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
