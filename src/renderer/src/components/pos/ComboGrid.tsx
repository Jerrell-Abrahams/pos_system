import type { Combo } from '@shared/types'
import { ComboCard } from './ComboCard'

interface ComboGridProps {
  combos: Combo[]
  onSelect: (combo: Combo) => void
}

export function ComboGrid({ combos, onSelect }: ComboGridProps): React.JSX.Element {
  if (combos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        <p>No combos yet — a manager can add one in Promotions.</p>
      </div>
    )
  }

  return (
    <div className="grid h-full content-start grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 overflow-y-auto p-3">
      {combos.map((combo) => (
        <ComboCard key={combo.id} combo={combo} onSelect={onSelect} />
      ))}
    </div>
  )
}
