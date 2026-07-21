import { useEffect, useMemo, useState } from 'react'
import { COMBO_CATEGORIES, type ComboCategory } from '@shared/types'
import { daysAgoLocalDate, todayLocalDate } from '@shared/dates'
import { distinctSizes, parseSize } from '@shared/productSize'
import { playBeep } from '../../lib/beep'
import { useCartStore } from '../../stores/cartStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { useCombosStore } from '../../stores/combosStore'
import { CartPanel } from './CartPanel'
import { CategoryRail } from './CategoryRail'
import { ComboGrid } from './ComboGrid'
import { ProductGrid } from './ProductGrid'
import { SearchBar } from './SearchBar'
import { useBarcodeScanner } from './useBarcodeScanner'

// Same window the customer display's "Most Popular" slide uses, so the two can't disagree about
// what is selling.
const POPULAR_LOOKBACK_DAYS = 29

function PosScreen(): React.JSX.Element {
  const categories = useCatalogStore((s) => s.categories)
  const products = useCatalogStore((s) => s.products)
  const loaded = useCatalogStore((s) => s.loaded)
  const loadCatalog = useCatalogStore((s) => s.load)
  const addProduct = useCartStore((s) => s.addProduct)
  const combos = useCombosStore((s) => s.combos)
  const combosLoaded = useCombosStore((s) => s.loaded)
  const loadCombos = useCombosStore((s) => s.load)
  const addCombo = useCartStore((s) => s.addCombo)

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [showCombos, setShowCombos] = useState(false)
  const [comboCategory, setComboCategory] = useState<ComboCategory>('Specials')
  const [searchText, setSearchText] = useState('')
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [qtySoldByProduct, setQtySoldByProduct] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (!loaded) void loadCatalog()
  }, [loaded, loadCatalog])

  // Ranking is a snapshot taken on mount, not live: it only shifts over weeks, and re-sorting the
  // grid under a cashier's thumb mid-shift would move the tile they were reaching for.
  useEffect(() => {
    void window.api.analytics
      .productPerformance({ startDate: daysAgoLocalDate(POPULAR_LOOKBACK_DAYS), endDate: todayLocalDate() })
      .then((rows) => setQtySoldByProduct(new Map(rows.map((r) => [r.productId, r.qtySold]))))
      // Ranking is a nicety; if it can't load, the grid falls back to its name-sorted order rather
      // than leaving the promise rejection unhandled.
      .catch(() => setQtySoldByProduct(new Map()))
  }, [])

  useEffect(() => {
    if (!combosLoaded) void loadCombos()
  }, [combosLoaded, loadCombos])

  function triggerFlash(): void {
    setFlash(true)
    setTimeout(() => setFlash(false), 200)
  }

  function handleScan(code: string): void {
    const product = products.find((p) => p.barcodes.includes(code))
    if (!product) return
    addProduct(product)
    triggerFlash()
    playBeep()
  }

  useBarcodeScanner(handleScan)

  // Products matching category + search, before the size chip is applied — the chip row is built
  // from this set so switching sizes never makes the other size chips disappear.
  const categoryMatched = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return products.filter((product) => {
      if (selectedCategoryId !== null && product.categoryId !== selectedCategoryId) return false
      if (!query) return true
      return product.name.toLowerCase().includes(query) || product.barcodes.some((b) => b.includes(query))
    })
  }, [products, selectedCategoryId, searchText])

  const sizeChips = useMemo(() => distinctSizes(categoryMatched.map((p) => p.name)), [categoryMatched])
  // Relax a stale selection to "All" once it no longer applies -- either the size dropped out of
  // the list, or the chip row itself is about to hide (sizeChips.length > 1 below), which would
  // otherwise leave the filter silently active with no chip left to clear it.
  const effectiveSize = selectedSize && sizeChips.length > 1 && sizeChips.includes(selectedSize) ? selectedSize : null

  const filteredProducts = useMemo(() => {
    const matched = effectiveSize
      ? categoryMatched.filter((p) => parseSize(p.name)?.label === effectiveSize)
      : categoryMatched

    // Best sellers first, so the tiles a cashier hits all shift are in the first row rather than
    // wherever the alphabet put them. Name breaks ties, which also means a till with no sales yet
    // (every qty 0) simply reads alphabetically instead of in some arbitrary order.
    return [...matched].sort((a, b) => {
      const byQty = (qtySoldByProduct.get(b.id) ?? 0) - (qtySoldByProduct.get(a.id) ?? 0)
      return byQty !== 0 ? byQty : a.name.localeCompare(b.name)
    })
  }, [categoryMatched, effectiveSize, qtySoldByProduct])

  const activeCombos = useMemo(() => combos.filter((c) => c.active), [combos])
  const shownCombos = useMemo(
    () => activeCombos.filter((c) => c.category === comboCategory),
    [activeCombos, comboCategory]
  )

  return (
    <div className={`flex h-full transition-shadow ${flash ? 'shadow-[inset_0_0_0_4px_var(--color-accent)]' : ''}`}>
      <CategoryRail
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={(id) => {
          setShowCombos(false)
          setSelectedCategoryId(id)
          setSelectedSize(null)
        }}
        combosActive={showCombos}
        onSelectCombos={() => setShowCombos(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {showCombos ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex gap-2 overflow-x-auto p-3 pb-0">
              {COMBO_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setComboCategory(c)}
                  className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-medium ${
                    comboCategory === c
                      ? 'border-accent-border bg-accent-tint text-accent-light'
                      : 'border-border text-ink-muted active:bg-accent-tint'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              <ComboGrid combos={shownCombos} onSelect={addCombo} />
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 pb-2">
              <SearchBar value={searchText} onChange={setSearchText} />
            </div>
            {sizeChips.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-3 pb-2">
                <SizeChip label="All" active={effectiveSize === null} onClick={() => setSelectedSize(null)} />
                {sizeChips.map((size) => (
                  <SizeChip
                    key={size}
                    label={size}
                    active={effectiveSize === size}
                    onClick={() => setSelectedSize(size)}
                  />
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1">
              <ProductGrid products={filteredProducts} onSelect={addProduct} />
            </div>
          </>
        )}
      </div>
      <CartPanel />
    </div>
  )
}

function SizeChip({
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
      className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-medium ${
        active
          ? 'border-accent-border bg-accent-tint text-accent-light'
          : 'border-border text-ink-muted active:bg-accent-tint'
      }`}
    >
      {label}
    </button>
  )
}

export default PosScreen
