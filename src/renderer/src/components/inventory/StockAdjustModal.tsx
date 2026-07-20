import { useState } from 'react'
import type { ProductDetail } from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { useProductsStore } from '../../stores/productsStore'
import { useToastStore } from '../../stores/toastStore'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Keypad } from '../common/Keypad'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { useBarcodeScanner } from '../pos/useBarcodeScanner'

interface StockAdjustModalProps {
  product: ProductDetail
  onSaved: () => void
  onClose: () => void
}

const MAX_QTY = 99999

export function StockAdjustModal({ product, onSaved, onClose }: StockAdjustModalProps): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const employee = useAuthStore((s) => s.employee)
  const targetName = useProductsStore((s) => s.products).find((p) => p.id === product.splitTargetProductId)?.name ?? null
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [qty, setQty] = useState(0)
  const [reason, setReason] = useState('')
  const [showManagerGate, setShowManagerGate] = useState(false)
  const [confirmingSplit, setConfirmingSplit] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // One scan = one unit of this already-selected product. A code that isn't one of this product's
  // barcodes almost always means the wrong item got picked up mid-scan, so it's rejected rather
  // than silently counted. A product with no barcodes accepts any scan (nothing to match against).
  useBarcodeScanner((code) => {
    if (product.barcodes.length > 0 && !product.barcodes.includes(code)) {
      pushToast('Scanned barcode does not match this product', 'error')
      return
    }
    setQty((v) => Math.min(v + 1, MAX_QTY))
  })

  function handleDigit(digit: string): void {
    setQty((v) => Math.min(v * 10 + Number(digit), MAX_QTY))
  }

  function handleBackspace(): void {
    setQty((v) => Math.floor(v / 10))
  }

  async function save(authorizedBy: number): Promise<void> {
    setShowManagerGate(false)
    setSubmitting(true)
    setError('')
    try {
      await window.api.inventory.adjustStock({
        productId: product.id,
        authorizedBy,
        deltaQty: direction === 'in' ? qty : -qty,
        reason: reason.trim()
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not adjust stock')
    } finally {
      setSubmitting(false)
    }
  }

  async function splitPack(): Promise<void> {
    setConfirmingSplit(false)
    if (!employee) return
    setSubmitting(true)
    setError('')
    try {
      await window.api.inventory.splitPack({ packProductId: product.id, employeeId: employee.id })
      pushToast('Pack split into 6 singles', 'info')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not split pack')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmingSplit) {
    return (
      <ConfirmDialog
        title="Split Pack"
        message="Split 1 pack into 6 singles?"
        confirmLabel="Split"
        onConfirm={() => void splitPack()}
        onCancel={() => setConfirmingSplit(false)}
      />
    )
  }

  if (showManagerGate) {
    return (
      <ManagerPinModal
        title="Manager approval required"
        message="Adjusting stock needs a manager PIN."
        onAuthorized={(managerId) => void save(managerId)}
        onCancel={() => setShowManagerGate(false)}
      />
    )
  }

  const valid = qty > 0 && reason.trim().length > 0
  const newTotal = product.stockQty + (direction === 'in' ? qty : -qty)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-96 overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">{product.name}</h2>
        <p className="mt-1 text-center text-sm text-ink-muted">Currently {product.stockQty} in stock</p>

        {product.is6Pack && (
          <div className="mt-4 rounded-xl border border-border bg-bg p-3 text-center">
            <p className="text-xs text-ink-muted">Splits into 6 × {targetName ?? '(no single product set)'}</p>
            <button
              type="button"
              disabled={!targetName || product.stockQty < 1 || submitting}
              onClick={() => setConfirmingSplit(true)}
              className="mt-2 h-12 w-full rounded-xl border border-accent-border bg-accent-tint text-sm font-semibold text-accent-light disabled:opacity-40"
            >
              Split Pack
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
              direction === 'in'
                ? 'border-accent-border bg-accent-tint text-accent-light'
                : 'border-border text-ink-muted'
            }`}
          >
            Received (+)
          </button>
          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
              direction === 'out' ? 'border-danger bg-danger/10 text-danger' : 'border-border text-ink-muted'
            }`}
          >
            Removed (−)
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-center">
          <p className="text-xs text-ink-muted">Quantity</p>
          <p className="text-3xl font-semibold text-ink">
            {direction === 'in' ? '+' : '−'}
            {qty}
          </p>
          {/* Show the real resulting total, not a floored one — the backend stores this exact
              value (stock can go negative, same as an oversell), so a clamped preview would let a
              manager confirm "0" while -150 is written. A negative previews in danger red. */}
          <p className={`mt-1 text-sm ${newTotal < 0 ? 'text-danger' : 'text-ink-muted'}`}>
            New total: {newTotal}
          </p>
        </div>

        <p className="mt-2 text-center text-xs text-ink-muted">
          Scan each item to add 1, or use the keypad below
        </p>

        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (e.g. delivery, breakage, stock count)"
          className="mt-3 h-12 w-full rounded-xl border border-border bg-bg px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
        />

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <div className="mt-4">
          <Keypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={() => setShowManagerGate(true)}
            submitLabel="Save Adjustment"
            submitDisabled={!valid || submitting}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
