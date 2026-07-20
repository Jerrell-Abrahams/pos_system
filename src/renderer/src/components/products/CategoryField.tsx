import { useState } from 'react'
import type { Category } from '@shared/types'
import { useCatalogStore } from '../../stores/catalogStore'
import { useProductsStore } from '../../stores/productsStore'
import { useToastStore } from '../../stores/toastStore'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { Select } from '../common/Select'

interface CategoryFieldProps {
  categories: Category[]
  value: number | null
  onChange: (id: number | null) => void
}

// The category dropdown plus inline add/remove. Both mutations are manager-gated (same as products),
// so this owns its own PIN modal. On success it reloads the products + catalog stores, which re-feeds
// the fresh `categories` prop back down from ProductsScreen.
export function CategoryField({ categories, value, onChange }: CategoryFieldProps): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [gate, setGate] = useState<'create' | 'delete' | null>(null)
  const pushToast = useToastStore((s) => s.push)

  async function reload(): Promise<void> {
    await Promise.all([useProductsStore.getState().load(), useCatalogStore.getState().load()])
  }

  async function create(authorizedBy: number): Promise<void> {
    setGate(null)
    try {
      const category = await window.api.catalog.createCategory({ name: newName.trim(), authorizedBy })
      await reload()
      onChange(category.id)
      setAdding(false)
      setNewName('')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not add category', 'error')
    }
  }

  async function remove(authorizedBy: number): Promise<void> {
    setGate(null)
    if (value === null) return
    try {
      await window.api.catalog.deleteCategory({ id: value, authorizedBy })
      await reload()
      onChange(useProductsStore.getState().categories[0]?.id ?? null)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not remove category', 'error')
    }
  }

  const squareBtn = 'h-12 w-12 shrink-0 rounded-xl border border-border text-ink-muted active:bg-accent-tint'

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select value={value ?? ''} onChange={(v) => onChange(v ? Number(v) : null)}>
            {categories.length === 0 && <option value="">No categories yet — add one →</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-label="Add category"
          className={`${squareBtn} text-xl leading-none`}
        >
          +
        </button>
        <button
          type="button"
          disabled={value === null}
          onClick={() => setGate('delete')}
          aria-label="Remove selected category"
          className={`${squareBtn} flex items-center justify-center active:border-danger active:text-danger disabled:opacity-40`}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <path
              d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                e.preventDefault()
                setGate('create')
              }
            }}
            placeholder="New category name"
            className="h-12 flex-1 rounded-xl border border-border bg-bg px-3 text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
          />
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={() => setGate('create')}
            className="h-12 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-bg active:bg-accent-light disabled:opacity-40"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setNewName('')
            }}
            className="h-12 shrink-0 rounded-xl border border-border px-4 text-sm font-medium text-ink-muted active:bg-accent-tint"
          >
            Cancel
          </button>
        </div>
      )}

      {gate && (
        <ManagerPinModal
          message={gate === 'create' ? 'Adding a category needs a manager PIN.' : 'Removing a category needs a manager PIN.'}
          onAuthorized={(managerId) => void (gate === 'create' ? create(managerId) : remove(managerId))}
          onCancel={() => setGate(null)}
        />
      )}
    </>
  )
}
