import { useEffect, useMemo, useState } from 'react'
import { formatRands } from '@shared/money'
import type { ProductDetail } from '@shared/types'
import { useCatalogStore } from '../../stores/catalogStore'
import { useProductsStore } from '../../stores/productsStore'
import { CategoryTabs } from '../common/CategoryTabs'
import { SearchBar } from '../pos/SearchBar'
import { ProductFormModal } from './ProductFormModal'

export function ProductsScreen(): React.JSX.Element {
  const categories = useProductsStore((s) => s.categories)
  const products = useProductsStore((s) => s.products)
  const loaded = useProductsStore((s) => s.loaded)
  const load = useProductsStore((s) => s.load)
  const reloadCatalog = useCatalogStore((s) => s.load)

  const [searchText, setSearchText] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [editing, setEditing] = useState<ProductDetail | null | 'new'>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: number | null): string => (id !== null ? (map.get(id) ?? '—') : '—')
  }, [categories])

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return products.filter((p) => {
      if (selectedCategoryId !== null && p.categoryId !== selectedCategoryId) return false
      if (!query) return true
      return p.name.toLowerCase().includes(query) || p.barcodes.some((b) => b.includes(query))
    })
  }, [products, selectedCategoryId, searchText])

  function handleSaved(): void {
    setEditing(null)
    void load()
    void reloadCatalog()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={searchText} onChange={setSearchText} autoFocus />
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="h-16 shrink-0 rounded-xl bg-accent px-6 text-sm font-semibold text-bg active:bg-accent-light"
        >
          Add Product
        </button>
      </div>

      <div className="mt-3">
        <CategoryTabs
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filtered.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => setEditing(product)}
            className={`flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-left ${
              product.active ? '' : 'opacity-50'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {product.name} {!product.active && <span className="text-danger">(inactive)</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {categoryName(product.categoryId)} ·{' '}
                {product.barcodes.length === 0
                  ? 'no barcode'
                  : product.barcodes.length === 1
                    ? product.barcodes[0]
                    : `${product.barcodes.length} barcodes`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-accent-light">{formatRands(product.sellPriceCents)}</p>
              <p
                className={`text-xs ${product.stockQty <= product.lowStockThreshold ? 'text-danger' : 'text-ink-muted'}`}
              >
                {product.stockQty} in stock
              </p>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="pt-8 text-center text-sm text-ink-muted">No products found</p>}
      </div>
      {editing !== null && (
        <ProductFormModal
          categories={categories}
          product={editing === 'new' ? null : editing}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
