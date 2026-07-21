import { useMemo, useState } from 'react'
import { formatRands } from '@shared/money'
import { COMBO_CATEGORIES, type Category, type Combo, type ComboCategory, type ComboItemInput, type Product } from '@shared/types'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { ModalBackdrop } from '../common/ModalBackdrop'
import { MoneyField } from '../common/MoneyField'
import { Select } from '../common/Select'

interface ComboFormModalProps {
  products: Product[]
  categories: Category[]
  combo: Combo | null
  onSaved: () => void
  onClose: () => void
}

export function ComboFormModal({ products, categories, combo, onSaved, onClose }: ComboFormModalProps): React.JSX.Element {
  const [category, setCategory] = useState<ComboCategory>(combo?.category ?? 'Specials')

  // Specials (free-form) state.
  const [name, setName] = useState(combo?.name ?? '')
  const [priceCents, setPriceCents] = useState(combo?.priceCents ?? 0)
  const [items, setItems] = useState<ComboItemInput[]>(
    combo && combo.category === 'Specials' ? combo.items.map((i) => ({ productId: i.productId, qty: i.qty })) : []
  )
  const [pickProductId, setPickProductId] = useState<number | null>(products[0]?.id ?? null)
  const [pickQty, setPickQty] = useState(1)

  // Spirit (guided) state.
  const bottleItem = combo?.items.find((i) => i.role === 'bottle')
  const mixerItem = combo?.items.find((i) => i.role === 'mixer')
  const categoryOfProduct = useMemo(
    () => new Map(products.map((p) => [p.id, p.categoryId])),
    [products]
  )
  const [bottleCategoryId, setBottleCategoryId] = useState<number | null>(
    bottleItem ? categoryOfProduct.get(bottleItem.productId) ?? null : null
  )
  const [mixerCategoryId, setMixerCategoryId] = useState<number | null>(
    mixerItem ? categoryOfProduct.get(mixerItem.productId) ?? null : null
  )
  const [bottleProductId, setBottleProductId] = useState<number | null>(bottleItem?.productId ?? products[0]?.id ?? null)
  const [mixerProductId, setMixerProductId] = useState<number | null>(mixerItem?.productId ?? products[0]?.id ?? null)
  const [chargeExtraCents, setChargeExtraCents] = useState(combo?.chargeExtraCents ?? 0)

  const [active, setActive] = useState(combo?.active ?? true)
  const [showManagerGate, setShowManagerGate] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const productName = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p.name]))
    return (id: number): string => map.get(id) ?? `Product ${id}`
  }, [products])

  const componentsCents = useMemo(() => {
    const priceMap = new Map(products.map((p) => [p.id, p.sellPriceCents]))
    return items.reduce((sum, i) => sum + (priceMap.get(i.productId) ?? 0) * i.qty, 0)
  }, [items, products])

  const bottleProducts = products.filter((p) => bottleCategoryId === null || p.categoryId === bottleCategoryId)
  const mixerProducts = products.filter((p) => mixerCategoryId === null || p.categoryId === mixerCategoryId)
  const bottle = products.find((p) => p.id === bottleProductId)
  const mixer = products.find((p) => p.id === mixerProductId)
  const spiritPriceCents = (bottle?.sellPriceCents ?? 0) + chargeExtraCents

  const isSpirit = category !== 'Specials'
  const valid = isSpirit
    ? bottleProductId !== null && mixerProductId !== null
    : name.trim().length > 0 && priceCents > 0 && items.length > 0

  function changeCategory(next: ComboCategory): void {
    setCategory(next)
    // Switching to e.g. "Whiskey" pre-filters the bottle list to a same-named product category if one
    // exists, so the manager usually only has to pick the bottle itself.
    if (next !== 'Specials' && bottleCategoryId === null) {
      const match = categories.find((c) => c.name.toLowerCase() === next.toLowerCase())
      if (match) selectBottleCategory(match.id)
    }
  }

  function selectBottleCategory(catId: number | null): void {
    setBottleCategoryId(catId)
    const first = products.find((p) => catId === null || p.categoryId === catId)
    setBottleProductId(first?.id ?? null)
  }

  function selectMixerCategory(catId: number | null): void {
    setMixerCategoryId(catId)
    const first = products.find((p) => catId === null || p.categoryId === catId)
    setMixerProductId(first?.id ?? null)
  }

  function addItem(): void {
    if (pickProductId === null || pickQty <= 0) return
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === pickProductId)
      if (existing) return prev.map((i) => (i.productId === pickProductId ? { ...i, qty: i.qty + pickQty } : i))
      return [...prev, { productId: pickProductId, qty: pickQty }]
    })
    setPickQty(1)
  }

  function removeItem(productId: number): void {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  async function save(authorizedBy: number): Promise<void> {
    setShowManagerGate(false)
    setSubmitting(true)
    setError('')
    try {
      const payload = isSpirit
        ? {
            category,
            name: name.trim(),
            priceCents: 0,
            items: [],
            bottleProductId,
            mixerProductId,
            chargeExtraCents,
            authorizedBy
          }
        : {
            category,
            name: name.trim(),
            priceCents,
            items,
            bottleProductId: null,
            mixerProductId: null,
            chargeExtraCents: null,
            authorizedBy
          }
      if (combo) {
        await window.api.promotions.update({ ...payload, id: combo.id, active })
      } else {
        await window.api.promotions.create(payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save combo')
    } finally {
      setSubmitting(false)
    }
  }

  if (showManagerGate) {
    return (
      <ManagerPinModal
        title="Manager approval required"
        message={`${combo ? 'Editing' : 'Adding'} a combo needs a manager PIN.`}
        onAuthorized={(managerId) => void save(managerId)}
        onCancel={() => setShowManagerGate(false)}
      />
    )
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="max-h-[90vh] w-[540px] overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">{combo ? 'Edit Combo' : 'Add Combo'}</h2>

        <div className="mt-4 space-y-3">
          <Field label="Category">
            <Select value={category} onChange={(v) => changeCategory(v as ComboCategory)} surface="surface">
              {COMBO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={isSpirit ? 'Name (optional — defaults to bottle + mixer)' : 'Name'}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSpirit && bottle && mixer ? `${bottle.name} + ${mixer.name}` : undefined}
              className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink focus:border-accent-border focus:outline-none"
            />
          </Field>

          {isSpirit ? (
            <>
              <Field label="Bottle (the spirit)">
                <div className="space-y-2">
                  <Select
                    value={bottleCategoryId ?? ''}
                    onChange={(v) => selectBottleCategory(v ? Number(v) : null)}
                    surface="surface"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={bottleProductId ?? ''}
                    onChange={(v) => setBottleProductId(v ? Number(v) : null)}
                    surface="surface"
                  >
                    {bottleProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatRands(p.sellPriceCents)}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>

              <Field label="Mixer (the soft drink)">
                <div className="space-y-2">
                  <Select
                    value={mixerCategoryId ?? ''}
                    onChange={(v) => selectMixerCategory(v ? Number(v) : null)}
                    surface="surface"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={mixerProductId ?? ''}
                    onChange={(v) => setMixerProductId(v ? Number(v) : null)}
                    surface="surface"
                  >
                    {mixerProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>

              <p className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink-muted">
                🧊 Ice is always included and deducted from stock.
              </p>

              <MoneyField label="Charge extra (added to the bottle price)" cents={chargeExtraCents} onChange={setChargeExtraCents} />

              <div className="rounded-xl border border-accent-border bg-accent-tint px-3 py-2">
                <p className="text-sm text-ink">
                  {bottle && mixer ? name.trim() || `${bottle.name} + ${mixer.name}` : 'Pick a bottle and a mixer'}
                </p>
                <p className="text-sm font-semibold text-accent-light">Combo price: {formatRands(spiritPriceCents)}</p>
              </div>
            </>
          ) : (
            <>
              <MoneyField label="Combo price" cents={priceCents} onChange={setPriceCents} />

              <Field label="Items in this combo">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2"
                    >
                      <span className="text-sm text-ink">
                        {item.qty} x {productName(item.productId)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        aria-label="Remove item"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-sm text-ink-muted">No items added yet</p>}
                </div>

                <div className="mt-3 space-y-3 rounded-xl border border-border bg-bg p-3">
                  <Select
                    value={pickProductId ?? ''}
                    onChange={(v) => setPickProductId(v ? Number(v) : null)}
                    surface="surface"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>

                  <div className="flex items-center gap-3">
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPickQty((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-lg text-ink active:bg-accent-tint"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-base font-medium text-ink">{pickQty}</span>
                      <button
                        type="button"
                        onClick={() => setPickQty((q) => q + 1)}
                        aria-label="Increase quantity"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-lg text-ink active:bg-accent-tint"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={pickProductId === null}
                      className="h-11 flex-1 rounded-xl border border-accent-border bg-accent-tint text-sm font-medium text-accent-light disabled:opacity-40"
                    >
                      Add to combo
                    </button>
                  </div>
                </div>
              </Field>

              {items.length > 0 && (
                <p className="text-sm text-ink-muted">
                  Bought separately: {formatRands(componentsCents)}
                  {priceCents > 0 && componentsCents > priceCents && (
                    <span className="text-accent-light"> · saves {formatRands(componentsCents - priceCents)}</span>
                  )}
                </p>
              )}
            </>
          )}

          {combo && (
            <button
              type="button"
              onClick={() => setActive((a) => !a)}
              className={`h-12 w-full rounded-xl border text-sm font-medium ${
                active ? 'border-border text-ink-muted' : 'border-danger text-danger'
              }`}
            >
              {active ? 'Active — tap to deactivate' : 'Inactive — tap to reactivate'}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || submitting}
            onClick={() => setShowManagerGate(true)}
            className="h-14 flex-1 rounded-xl bg-accent text-sm font-semibold text-bg active:bg-accent-light disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <label className="text-xs text-ink-muted">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
