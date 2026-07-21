import type { Combo } from '@shared/types'
import { formatRands } from '@shared/money'

interface ComboCardProps {
  combo: Combo
  onSelect: (combo: Combo) => void
}

export function ComboCard({ combo, onSelect }: ComboCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(combo)}
      className="flex min-h-[90px] flex-col justify-between rounded-xl border border-accent-border bg-accent-tint p-3 text-left active:bg-accent-border/40"
    >
      <div>
        <span className="text-sm font-medium text-ink">🎁 {combo.name}</span>
        <p className="mt-1 text-xs text-ink-muted">
          {combo.items.map((i) => `${i.qty}x ${i.productName}`).join(' + ')}
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-accent-light">{formatRands(combo.priceCents)}</span>
        {combo.componentsCents > combo.priceCents && (
          <span className="text-xs text-ink-muted line-through">{formatRands(combo.componentsCents)}</span>
        )}
      </div>
    </button>
  )
}
