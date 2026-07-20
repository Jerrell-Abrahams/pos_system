import type { Category } from '@shared/types'

interface CategoryTabsProps {
  categories: Category[]
  selectedCategoryId: number | null
  onSelect: (id: number | null) => void
}

// Horizontal filter for the list-shaped management screens (Products, Inventory). The POS uses a
// vertical CategoryRail instead — that one is sized for the touch grid and carries a Combos button
// these screens have no use for, so the two stay separate rather than one bending to fit both.
export function CategoryTabs({ categories, selectedCategoryId, onSelect }: CategoryTabsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Tab label="All" active={selectedCategoryId === null} onClick={() => onSelect(null)} />
      {categories.map((c) => (
        <Tab key={c.id} label={c.name} active={selectedCategoryId === c.id} onClick={() => onSelect(c.id)} />
      ))}
    </div>
  )
}

function Tab({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl border px-4 text-sm font-medium ${
        active
          ? 'border-accent-border bg-accent-tint text-accent-light'
          : 'border-border text-ink-muted active:bg-accent-tint'
      }`}
    >
      {label}
    </button>
  )
}
