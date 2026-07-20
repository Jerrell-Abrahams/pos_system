import { useEffect, useState } from 'react'
import { formatDateTime } from '@shared/receipt'
import { parseDbTimestamp } from '@shared/dates'
import { formatRands } from '@shared/money'
import type { SaleDetail } from '@shared/types'
import { useToastStore } from '../../stores/toastStore'
import { ManagerPinModal } from '../common/ManagerPinModal'

interface SaleDetailModalProps {
  saleId: number
  onVoided: () => void
  onClose: () => void
}

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', eft: 'EFT' }

export function SaleDetailModal({ saleId, onVoided, onClose }: SaleDetailModalProps): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showManagerGate, setShowManagerGate] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.api.sales.detail(saleId).then(setDetail)
  }, [saleId])

  async function reprint(): Promise<void> {
    const result = await window.api.sales.reprint(saleId)
    pushToast(result.ok ? 'Receipt sent to printer' : `Reprint failed: ${result.error}`, result.ok ? 'info' : 'error')
  }

  async function confirmVoid(authorizedBy: number): Promise<void> {
    setShowManagerGate(false)
    setError('')
    try {
      const updated = await window.api.sales.void({ saleId, authorizedBy, reason: voidReason.trim() })
      setDetail(updated)
      setVoiding(false)
      onVoided()
      pushToast(`${updated.receiptNo} voided — stock restored`, 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void sale')
    }
  }

  if (showManagerGate) {
    return (
      <ManagerPinModal
        title="Manager approval required"
        message="Voiding a sale needs a manager PIN."
        onAuthorized={(managerId) => void confirmVoid(managerId)}
        onCancel={() => setShowManagerGate(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[90vh] w-[420px] overflow-y-auto rounded-2xl border border-border bg-surface p-6">
        {!detail ? (
          <p className="text-center text-sm text-ink-muted">Loading…</p>
        ) : (
          <>
            <h2 className="text-center text-lg font-semibold text-ink">{detail.receiptNo}</h2>
            <p className="mt-1 text-center text-sm text-ink-muted">
              {formatDateTime(parseDbTimestamp(detail.createdAt))} · {detail.cashierName}
            </p>

            {detail.status !== 'completed' && (
              <p className="mt-3 rounded-xl border border-danger p-2 text-center text-sm font-medium uppercase text-danger">
                {detail.status}
                {detail.voidReason && ` — ${detail.voidReason}`}
              </p>
            )}

            <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              {detail.items.map((item, i) => (
                <div key={i} className="flex justify-between text-ink">
                  <span>
                    {item.qty} x {item.productName}
                  </span>
                  <span>{formatRands(item.lineTotalCents)}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span>{formatRands(detail.subtotalCents)}</span>
              </div>
              {detail.comboDiscountCents !== 0 && (
                <div className="flex justify-between text-accent-light">
                  <span>{detail.comboDiscountCents > 0 ? 'Promotions' : 'Combo adjustment'}</span>
                  <span>
                    {detail.comboDiscountCents > 0 ? '−' : '+'}
                    {formatRands(Math.abs(detail.comboDiscountCents))}
                  </span>
                </div>
              )}
              {detail.discountCents > 0 && (
                <div className="flex justify-between text-accent-light">
                  <span>Discount</span>
                  <span>−{formatRands(detail.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold text-ink">
                <span>Total</span>
                <span>{formatRands(detail.totalCents)}</span>
              </div>
            </div>

            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              {detail.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-ink-muted">
                  <span>
                    {METHOD_LABEL[p.method] ?? p.method}
                    {p.terminal && ` · ${p.terminal}`}
                  </span>
                  <span>{formatRands(p.amountCents)}</span>
                </div>
              ))}
            </div>

            {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

            {voiding ? (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Reason for voiding this sale"
                  className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiding(false)}
                    className="h-12 flex-1 rounded-xl border border-border text-sm font-medium text-ink-muted active:bg-accent-tint"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={voidReason.trim().length === 0}
                    onClick={() => setShowManagerGate(true)}
                    className="h-12 flex-1 rounded-xl border border-danger text-sm font-medium text-danger disabled:opacity-40"
                  >
                    Confirm Void
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-14 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void reprint()}
                  className="h-14 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
                >
                  Reprint
                </button>
                {detail.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => setVoiding(true)}
                    className="h-14 flex-1 rounded-xl border border-danger text-sm font-medium text-danger active:bg-danger/10"
                  >
                    Void Sale
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
