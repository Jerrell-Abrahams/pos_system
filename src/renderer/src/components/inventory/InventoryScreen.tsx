import { useEffect, useMemo, useState } from 'react'
import type { ProductDetail } from '@shared/types'
import { useCatalogStore } from '../../stores/catalogStore'
import { useNavStore } from '../../stores/navStore'
import { useProductsStore } from '../../stores/productsStore'
import { CategoryTabs } from '../common/CategoryTabs'
import { SearchBar } from '../pos/SearchBar'
import { StockAdjustModal } from './StockAdjustModal'

export function InventoryScreen(): React.JSX.Element {
  const categories = useProductsStore((s) => s.categories)
  const products = useProductsStore((s) => s.products)
  const loaded = useProductsStore((s) => s.loaded)
  const load = useProductsStore((s) => s.load)
  const reloadCatalog = useCatalogStore((s) => s.load)
  const navParams = useNavStore((s) => s.params)

  const [searchText, setSearchText] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [adjusting, setAdjusting] = useState<ProductDetail | null>(null)
  // Captured once on mount — a Business Health card can deep-link here filtered to one
  // product, or sorted by urgency; normal sidebar navigation clears params before we mount.
  const [focusProductId] = useState(navParams?.productId ?? null)
  const [sortLowStock] = useState(navParams?.sortLowStock ?? false)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: number | null): string => (id !== null ? (map.get(id) ?? '—') : '—')
  }, [categories])

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])

  const scoped = useMemo(
    () => (focusProductId == null ? activeProducts : activeProducts.filter((p) => p.id === focusProductId)),
    [activeProducts, focusProductId]
  )

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const base = scoped.filter((p) => {
      if (selectedCategoryId !== null && p.categoryId !== selectedCategoryId) return false
      if (!query) return true
      return p.name.toLowerCase().includes(query) || p.barcodes.some((b) => b.includes(query))
    })
    if (!sortLowStock) return base
    return [...base].sort(
      (a, b) => a.stockQty / (a.lowStockThreshold || 1) - b.stockQty / (b.lowStockThreshold || 1)
    )
  }, [scoped, selectedCategoryId, searchText, sortLowStock])

  const lowStockCount = useMemo(
    () => activeProducts.filter((p) => p.stockQty <= p.lowStockThreshold).length,
    [activeProducts]
  )

  function handleSaved(): void {
    setAdjusting(null)
    void load()
    void reloadCatalog()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={searchText} onChange={setSearchText} autoFocus />
        </div>
        {lowStockCount > 0 && (
          <span className="shrink-0 rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger">
            {lowStockCount} low on stock
          </span>
        )}
      </div>

      {/* Hidden when deep-linked to a single product from a Business Health card: the list is
          already scoped to that one item, so a category filter could only empty it. */}
      {focusProductId == null && (
        <div className="mt-3">
          <CategoryTabs
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
          />
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filtered.map((product) => {
          const low = product.stockQty <= product.lowStockThreshold
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => setAdjusting(product)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-ink">{product.name}</p>
                <p className="text-xs text-ink-muted">{categoryName(product.categoryId)}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-semibold ${low ? 'text-danger' : 'text-ink'}`}>{product.stockQty}</p>
                <p className="text-xs text-ink-muted">alert at {product.lowStockThreshold}</p>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && <p className="pt-8 text-center text-sm text-ink-muted">No products found</p>}
      </div>

      {adjusting && <StockAdjustModal product={adjusting} onSaved={handleSaved} onClose={() => setAdjusting(null)} />}
    </div>
  )
}
