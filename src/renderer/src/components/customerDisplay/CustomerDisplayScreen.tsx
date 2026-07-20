import { useEffect, useMemo, useState } from 'react'
import { daysAgoLocalDate, todayLocalDate } from '@shared/dates'
import { formatRands } from '@shared/money'
import type { Category, Combo, DisplayProfile, DisplaySlideSource, Product, ProductPerformanceItem } from '@shared/types'

const REFRESH_INTERVAL_MS = 60_000
const POPULAR_LIMIT = 8
const POPULAR_LOOKBACK_DAYS = 29

// Computed fresh per call, not hoisted to a module constant — this window can stay open for
// days on a kiosk monitor, so a frozen "today" would let the 30-day window go stale.
function popularRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgoLocalDate(POPULAR_LOOKBACK_DAYS), endDate: todayLocalDate() }
}

type ResolvedSlide =
  | { kind: 'promotions'; title: string; combos: Combo[] }
  | { kind: 'products'; title: string; products: Product[] }
  | { kind: 'announcement'; message: string }

function autoTitle(source: DisplaySlideSource, categoryName: string | undefined): string {
  if (source === 'promotions') return 'Promotions'
  if (source === 'mostPopular') return 'Most Popular'
  return categoryName ?? 'Category'
}

interface CustomerDisplayScreenProps {
  profileId: number
}

export function CustomerDisplayScreen({ profileId }: CustomerDisplayScreenProps): React.JSX.Element {
  const [profile, setProfile] = useState<DisplayProfile | null | undefined>(undefined)
  const [combos, setCombos] = useState<Combo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [popular, setPopular] = useState<ProductPerformanceItem[]>([])
  const [slideIndex, setSlideIndex] = useState(0)

  useEffect(() => {
    async function refresh(): Promise<void> {
      const [profiles, combosResult, catalog, popularResult] = await Promise.all([
        window.api.displaySlides.get(),
        window.api.promotions.list(),
        window.api.catalog.list(),
        window.api.analytics.productPerformance(popularRange())
      ])
      setProfile(profiles.find((p) => p.id === profileId) ?? null)
      setCombos(combosResult)
      setProducts(catalog.products)
      setCategories(catalog.categories)
      setPopular(popularResult)
    }
    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [profileId])

  const resolvedSlides = useMemo<ResolvedSlide[]>(() => {
    if (!profile) return []
    const productById = new Map(products.map((p) => [p.id, p]))
    const categoryById = new Map(categories.map((c) => [c.id, c.name]))
    const popularProducts = popular
      .filter((p) => p.qtySold > 0)
      .slice(0, POPULAR_LIMIT)
      .map((p) => productById.get(p.productId))
      .filter((p): p is Product => p !== undefined)

    return profile.slides
      .map((slide): ResolvedSlide => {
        if (slide.source === 'announcement') return { kind: 'announcement', message: slide.title?.trim() ?? '' }
        const title = slide.title?.trim() || autoTitle(slide.source, categoryById.get(slide.categoryId ?? -1))
        if (slide.source === 'promotions') return { kind: 'promotions', title, combos: combos.filter((c) => c.active) }
        if (slide.source === 'category') {
          return { kind: 'products', title, products: products.filter((p) => p.categoryId === slide.categoryId) }
        }
        return { kind: 'products', title, products: popularProducts }
      })
      .filter((slide) => {
        if (slide.kind === 'promotions') return slide.combos.length > 0
        if (slide.kind === 'announcement') return slide.message.length > 0
        return slide.products.length > 0
      })
  }, [profile, combos, products, categories, popular])

  useEffect(() => {
    if (resolvedSlides.length === 0) return
    const seconds = profile?.slideSeconds ?? 8
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % resolvedSlides.length)
    }, seconds * 1000)
    return () => clearInterval(interval)
  }, [resolvedSlides.length, profile?.slideSeconds])

  const activeSlide = resolvedSlides[slideIndex % resolvedSlides.length]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg p-10">
      {profile === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-2xl text-ink-muted">Loading…</p>
        </div>
      ) : profile === null ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="text-2xl text-ink-muted">This display's configuration was removed</p>
        </div>
      ) : !activeSlide ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="text-2xl text-ink-muted">No slides to show yet — add slides in Display Manager, then save.</p>
        </div>
      ) : (
        // key={slideIndex} remounts on every rotation so the fade replays each time — slides
        // used to hard-cut. Reuses the shared .animate-screen-in from the login screen.
        <div key={slideIndex} className="animate-screen-in flex min-h-0 flex-1 flex-col">
          {activeSlide.kind === 'announcement' ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <p className="text-6xl font-semibold leading-tight text-accent-light">{activeSlide.message}</p>
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-semibold text-ink">{activeSlide.title}</h1>
              {activeSlide.kind === 'promotions' ? (
                <PromotionsGrid combos={activeSlide.combos} />
              ) : (
                <ProductPriceGrid products={activeSlide.products} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PromotionsGrid({ combos }: { combos: Combo[] }): React.JSX.Element {
  return (
    <div className="mt-8 grid flex-1 auto-rows-min grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 overflow-hidden">
      {combos.map((combo) => (
        <div key={combo.id} className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-2xl font-medium text-ink">{combo.name}</p>
          <p className="mt-2 text-3xl font-semibold text-accent-light">{formatRands(combo.priceCents)}</p>
        </div>
      ))}
    </div>
  )
}

function ProductPriceGrid({ products }: { products: Product[] }): React.JSX.Element {
  return (
    <div className="mt-8 grid flex-1 auto-rows-min grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 overflow-hidden">
      {products.map((product) => {
        const soldOut = product.stockQty <= 0
        return (
          <div
            key={product.id}
            className={`rounded-2xl border border-border bg-surface p-5 ${soldOut ? 'opacity-40' : ''}`}
          >
            <p className="text-xl font-medium text-ink">{product.name}</p>
            <p className={`mt-2 text-3xl font-semibold ${soldOut ? 'text-ink line-through' : 'text-accent-light'}`}>
              {formatRands(product.sellPriceCents)}
            </p>
            {soldOut && <p className="mt-1 text-sm font-medium uppercase tracking-wide text-ink-muted">Sold out</p>}
          </div>
        )
      })}
    </div>
  )
}
