import { useEffect, useState } from 'react'
import { formatRands } from '@shared/money'
import type { Combo } from '@shared/types'
import { useCatalogStore } from '../../stores/catalogStore'
import { useCombosStore } from '../../stores/combosStore'
import { ComboFormModal } from './ComboFormModal'

export function PromotionsScreen(): React.JSX.Element {
  const combos = useCombosStore((s) => s.combos)
  const loaded = useCombosStore((s) => s.loaded)
  const load = useCombosStore((s) => s.load)
  const products = useCatalogStore((s) => s.products)
  const loadCatalog = useCatalogStore((s) => s.load)
  const catalogLoaded = useCatalogStore((s) => s.loaded)

  const [editing, setEditing] = useState<Combo | null | 'new'>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  useEffect(() => {
    if (!catalogLoaded) void loadCatalog()
  }, [catalogLoaded, loadCatalog])

  function handleSaved(): void {
    setEditing(null)
    void load()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Promotions</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="h-16 shrink-0 rounded-xl bg-accent px-6 text-sm font-semibold text-bg active:bg-accent-light"
        >
          Add Combo
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {combos.map((combo) => (
          <button
            key={combo.id}
            type="button"
            onClick={() => setEditing(combo)}
            className={`flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-left ${
              combo.active ? '' : 'opacity-50'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-ink">
                🎁 {combo.name} {!combo.active && <span className="text-danger">(inactive)</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {combo.items.map((i) => `${i.qty}x ${i.productName}`).join(' + ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-accent-light">{formatRands(combo.priceCents)}</p>
              {combo.componentsCents > combo.priceCents && (
                <p className="text-xs text-ink-muted">saves {formatRands(combo.componentsCents - combo.priceCents)}</p>
              )}
            </div>
          </button>
        ))}
        {combos.length === 0 && <p className="pt-8 text-center text-sm text-ink-muted">No combos yet</p>}
      </div>

      {editing !== null && (
        <ComboFormModal
          products={products}
          combo={editing === 'new' ? null : editing}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
