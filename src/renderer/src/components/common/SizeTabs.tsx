interface SizeTabsProps {
  sizes: string[]
  selectedSize: string | null
  onSelect: (size: string | null) => void
}

// Sub-tabs under CategoryTabs for screens listing bottles/products, filtering by the size parsed
// out of the product name (see @shared/productSize). Hidden by the caller when there's nothing to
// split on (0 or 1 distinct size in the current category).
export function SizeTabs({ sizes, selectedSize, onSelect }: SizeTabsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Tab label="All" active={selectedSize === null} onClick={() => onSelect(null)} />
      {sizes.map((size) => (
        <Tab key={size} label={size} active={selectedSize === size} onClick={() => onSelect(size)} />
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
      className={`h-10 rounded-lg border px-4 text-sm font-medium transition-colors duration-100 ${
        active
          ? 'border-accent-border bg-accent-tint text-accent-light'
          : 'border-border text-ink-muted active:bg-accent-tint'
      }`}
    >
      {label}
    </button>
  )
}
