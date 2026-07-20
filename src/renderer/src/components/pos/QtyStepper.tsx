interface QtyStepperProps {
  qty: number
  onChange: (qty: number) => void
}

export function QtyStepper({ qty, onChange }: QtyStepperProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        className="flex h-16 w-16 items-center justify-center rounded-xl border border-border text-2xl text-ink active:bg-accent-tint"
      >
        −
      </button>
      <span className="w-8 text-center text-xl font-medium text-ink">{qty}</span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        className="flex h-16 w-16 items-center justify-center rounded-xl border border-border text-2xl text-ink active:bg-accent-tint"
      >
        +
      </button>
    </div>
  )
}
