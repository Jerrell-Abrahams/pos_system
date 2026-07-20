import type { Product } from '@shared/types'
import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: Product[]
  onSelect: (product: Product) => void
}

export function ProductGrid({ products, onSelect }: ProductGridProps): React.JSX.Element {
  if (products.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        <p>No products found.</p>
      </div>
    )
  }

  // h-full is what makes overflow-y-auto scroll at all: unbounded, the grid grows to fit every card
  // and overflows its parent, putting the tail of the catalogue out of reach. content-start stops
  // the rows stretching to fill the height when only a few products match.
  return (
    <div className="grid h-full content-start grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 overflow-y-auto p-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onSelect} />
      ))}
    </div>
  )
}
