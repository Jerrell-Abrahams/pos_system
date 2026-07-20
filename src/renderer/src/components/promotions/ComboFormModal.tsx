import { useMemo, useState } from 'react'
import { formatRands } from '@shared/money'
import type { Combo, ComboItemInput, Product } from '@shared/types'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { MoneyField } from '../common/MoneyField'
import { Select } from '../common/Select'

interface ComboFormModalProps {
  products: Product[]
  combo: Combo | null
  onSaved: () => void
  onClose: () => void
}

export function ComboFormModal({ products, combo, onSaved, onClose }: ComboFormModalProps): React.JSX.Element {
  const [name, setName] = useState(combo?.name ?? '')
  const [priceCents, setPriceCents] = useState(combo?.priceCents ?? 0)
  const [items, setItems] = useState<ComboItemInput[]>(
    combo?.items.map((i) => ({ productId: i.productId, qty: i.qty })) ?? []
  )
  const [pickProductId, setPickProductId] = useState<number | null>(products[0]?.id ?? null)
  const [pickQty, setPickQty] = useState(1)
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

  const valid = name.trim().length > 0 && priceCents > 0 && items.length > 0

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
      if (combo) {
        await window.api.promotions.update({ id: combo.id, name: name.trim(), priceCents, items, active, authorizedBy })
      } else {
        await window.api.promotions.create({ name: name.trim(), priceCents, items, authorizedBy })
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[90vh] w-[540px] overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">{combo ? 'Edit Combo' : 'Add Combo'}</h2>

        <div className="mt-4 space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink focus:border-accent-border focus:outline-none"
            />
          </Field>

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
    </div>
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
