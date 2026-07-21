import type { Category } from '@shared/types'
import { categoryIcon } from './categoryIcon'

interface CategoryRailProps {
  categories: Category[]
  selectedCategoryId: number | null
  onSelect: (id: number | null) => void
  combosActive: boolean
  onSelectCombos: () => void
}

export function CategoryRail({
  categories,
  selectedCategoryId,
  onSelect,
  combosActive,
  onSelectCombos
}: CategoryRailProps): React.JSX.Element {
  return (
    <div className="flex w-20 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface p-2">
      <CategoryButton label="Combos" icon="🎁" active={combosActive} onClick={onSelectCombos} />
      <div className="border-t border-border" />
      <CategoryButton
        label="All"
        icon="🍽️"
        active={!combosActive && selectedCategoryId === null}
        onClick={() => onSelect(null)}
      />
      {categories.map((c) => (
        <CategoryButton
          key={c.id}
          label={c.name}
          icon={categoryIcon(c.name)}
          active={!combosActive && selectedCategoryId === c.id}
          onClick={() => onSelect(c.id)}
        />
      ))}
    </div>
  )
}

function CategoryButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors duration-100 ${
        active ? 'border-border bg-ink/10 text-ink' : 'border-transparent text-ink-muted'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="w-full break-words text-[11px] font-medium leading-tight">{label}</span>
    </button>
  )
}
