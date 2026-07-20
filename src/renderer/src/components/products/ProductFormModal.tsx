import { useState } from 'react'
import type { Category, ProductDetail } from '@shared/types'
import { useToastStore } from '../../stores/toastStore'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { MoneyField } from '../common/MoneyField'
import { NumberStepperField } from '../common/NumberStepperField'
import { useBarcodeScanner } from '../pos/useBarcodeScanner'
import { CategoryField } from './CategoryField'

interface ProductFormModalProps {
  categories: Category[]
  product: ProductDetail | null
  onSaved: () => void
  onClose: () => void
}

export function ProductFormModal({ categories, product, onSaved, onClose }: ProductFormModalProps): React.JSX.Element {
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(product?.categoryId ?? categories[0]?.id ?? null)
  const [sellPriceCents, setSellPriceCents] = useState(product?.sellPriceCents ?? 0)
  const [costPriceCents, setCostPriceCents] = useState(product?.costPriceCents ?? 0)
  const [lowStockThreshold, setLowStockThreshold] = useState(product?.lowStockThreshold ?? 5)
  const [stockQty, setStockQty] = useState(product?.stockQty ?? 0)
  const [barcodes, setBarcodes] = useState<string[]>(product?.barcodes ?? [])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [active, setActive] = useState(product?.active ?? true)
  const [gate, setGate] = useState<'save' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pushToast = useToastStore((s) => s.push)

  function addBarcode(raw: string): void {
    const code = raw.trim()
    if (!code) return
    if (barcodes.includes(code)) {
      pushToast(`Barcode ${code} already added`, 'error')
      return
    }
    setBarcodes([...barcodes, code])
    setBarcodeInput('')
  }

  // Scan anywhere in the modal to add a code — no need to click the field first. A scan while the
  // text field is focused lands there instead, and its Enter handler adds it the same way.
  useBarcodeScanner(addBarcode)

  const valid = name.trim().length > 0 && sellPriceCents > 0

  async function save(authorizedBy: number): Promise<void> {
    setGate(null)
    setSubmitting(true)
    setError('')
    try {
      if (product) {
        await window.api.products.update({
          id: product.id,
          name: name.trim(),
          categoryId,
          sellPriceCents,
          costPriceCents,
          lowStockThreshold,
          barcodes,
          active,
          authorizedBy
        })
      } else {
        await window.api.products.create({
          name: name.trim(),
          categoryId,
          sellPriceCents,
          costPriceCents,
          stockQty,
          lowStockThreshold,
          barcodes,
          authorizedBy
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(authorizedBy: number): Promise<void> {
    if (!product) return
    setGate(null)
    setSubmitting(true)
    setError('')
    try {
      await window.api.products.delete({ id: product.id, authorizedBy })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete product')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmingDelete) {
    return (
      <ConfirmDialog
        title="Delete product?"
        message={`Permanently delete “${product?.name}”. This can't be undone. A product with sales or stock history can't be deleted — deactivate it instead.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false)
          setGate('delete')
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    )
  }

  if (gate) {
    return (
      <ManagerPinModal
        title="Manager approval required"
        message={
          gate === 'delete'
            ? 'Deleting a product needs a manager PIN.'
            : `${product ? 'Editing' : 'Adding'} a product needs a manager PIN.`
        }
        onAuthorized={(managerId) => void (gate === 'delete' ? remove(managerId) : save(managerId))}
        onCancel={() => setGate(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[90vh] w-[420px] overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">{product ? 'Edit Product' : 'Add Product'}</h2>

        <div className="mt-4 space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink focus:border-accent-border focus:outline-none"
            />
          </Field>

          <Field label="Category">
            <CategoryField categories={categories} value={categoryId} onChange={setCategoryId} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Sell price" cents={sellPriceCents} onChange={setSellPriceCents} />
            <MoneyField label="Cost price" cents={costPriceCents} onChange={setCostPriceCents} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberStepperField label="Low stock alert" value={lowStockThreshold} onChange={setLowStockThreshold} min={0} />
            {!product && (
              <NumberStepperField label="Starting stock" value={stockQty} onChange={setStockQty} min={0} />
            )}
          </div>

          <Field label="Barcodes (optional) — scan, or type and press Enter. One product can have several">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addBarcode(barcodeInput)
                }
              }}
              placeholder="Scan or type a code"
              className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
            />
            {barcodes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {barcodes.map((code) => (
                  <span
                    key={code}
                    className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ink"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => setBarcodes(barcodes.filter((b) => b !== code))}
                      className="text-ink-muted active:text-danger"
                      aria-label={`Remove ${code}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          {product && (
            <>
              <button
                type="button"
                onClick={() => setActive((a) => !a)}
                className={`h-12 w-full rounded-xl border text-sm font-medium ${
                  active ? 'border-border text-ink-muted' : 'border-danger text-danger'
                }`}
              >
                {active ? 'Active — tap to deactivate' : 'Inactive — tap to reactivate'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="h-12 w-full rounded-xl border border-danger text-sm font-medium text-danger active:bg-danger/10"
              >
                Delete product
              </button>
            </>
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
            onClick={() => setGate('save')}
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
