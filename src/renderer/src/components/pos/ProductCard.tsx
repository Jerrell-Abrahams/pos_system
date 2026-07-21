import type { Product } from '@shared/types'
import { formatRands } from '@shared/money'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
}

export function ProductCard({ product, onSelect }: ProductCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="flex min-h-[90px] flex-col justify-between rounded-xl border border-border bg-surface p-3 text-left active:border-accent-border active:bg-accent-tint"
    >
      <span className="line-clamp-2 text-sm font-normal text-ink-muted">{product.name}</span>
      <span className="text-xl font-bold text-accent-light">{formatRands(product.sellPriceCents)}</span>
    </button>
  )
}
