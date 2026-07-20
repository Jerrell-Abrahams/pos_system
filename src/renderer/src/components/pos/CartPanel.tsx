import { useState } from 'react'
import { calcDiscountCents, calcInclusiveVatCents, formatRands } from '@shared/money'
import {
  cartComboComponentsCents,
  cartComboDiscountCents,
  cartSubtotalCents,
  useCartStore
} from '../../stores/cartStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { CartLine } from './CartLine'
import { ComboCartLine } from './ComboCartLine'
import { DiscountModal } from './DiscountModal'
import { PaymentModal } from './PaymentModal'

export function CartPanel(): React.JSX.Element {
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const removeLine = useCartStore((s) => s.removeLine)
  const comboLines = useCartStore((s) => s.comboLines)
  const setComboQty = useCartStore((s) => s.setComboQty)
  const removeCombo = useCartStore((s) => s.removeCombo)
  const discount = useCartStore((s) => s.discount)
  const setDiscount = useCartStore((s) => s.setDiscount)
  const clear = useCartStore((s) => s.clear)
  const vatEnabled = useSettingsStore((s) => s.vatEnabled)
  const vatRatePercent = useSettingsStore((s) => s.vatRatePercent)

  const [confirmClear, setConfirmClear] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)

  const subtotalCents = cartSubtotalCents(lines) + cartComboComponentsCents(comboLines)
  const manualDiscountCents = calcDiscountCents(subtotalCents, discount)
  const comboDiscountCents = cartComboDiscountCents(comboLines)
  const discountCents = manualDiscountCents + comboDiscountCents
  const totalCents = subtotalCents - discountCents
  const vatCents = vatEnabled ? calcInclusiveVatCents(totalCents, vatRatePercent) : 0
  const isEmpty = lines.length === 0 && comboLines.length === 0

  return (
    <div className="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isEmpty && <p className="pt-8 text-center text-sm text-ink-muted">Cart is empty</p>}
        {comboLines.map((combo) => (
          <ComboCartLine
            key={combo.comboId}
            combo={combo}
            onChangeQty={(qty) => setComboQty(combo.comboId, qty)}
            onRemove={() => removeCombo(combo.comboId)}
          />
        ))}
        {lines.map((line) => (
          <CartLine
            key={line.productId}
            line={line}
            onChangeQty={(qty) => setQty(line.productId, qty)}
            onRemove={() => removeLine(line.productId)}
          />
        ))}
      </div>

      <div className="space-y-1 border-t border-border p-3">
        <div className="flex justify-between text-sm text-ink-muted">
          <span>Subtotal</span>
          <span>{formatRands(subtotalCents)}</span>
        </div>
        {comboDiscountCents !== 0 && (
          <div className="flex justify-between text-sm text-accent-light">
            <span>{comboDiscountCents > 0 ? 'Promotions' : 'Combo adjustment'}</span>
            <span>
              {comboDiscountCents > 0 ? '−' : '+'}
              {formatRands(Math.abs(comboDiscountCents))}
            </span>
          </div>
        )}
        {manualDiscountCents > 0 && (
          <div className="flex justify-between text-sm text-accent-light">
            <span>Discount</span>
            <span>−{formatRands(manualDiscountCents)}</span>
          </div>
        )}
        {vatEnabled && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>VAT incl. @ {vatRatePercent}%</span>
            <span>{formatRands(vatCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl font-semibold text-ink">
          <span>Total</span>
          <span>{formatRands(totalCents)}</span>
        </div>
      </div>

      <div className="space-y-2 p-3 pt-0">
        <button
          type="button"
          disabled={isEmpty}
          onClick={() => setPaymentOpen(true)}
          className="h-16 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light disabled:opacity-40"
        >
          Charge {formatRands(totalCents)}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isEmpty}
            onClick={() => setDiscountOpen(true)}
            className={`h-14 flex-1 rounded-xl border text-sm font-medium disabled:opacity-40 ${
              manualDiscountCents > 0
                ? 'border-accent-border bg-accent-tint text-accent-light'
                : 'border-border text-ink-muted'
            }`}
          >
            {manualDiscountCents > 0 ? `Discount −${formatRands(manualDiscountCents)}` : 'Discount'}
          </button>
          <button
            type="button"
            disabled={isEmpty}
            onClick={() => setConfirmClear(true)}
            className="h-14 flex-1 rounded-xl border border-danger text-sm font-medium text-danger disabled:opacity-40"
          >
            Clear sale
          </button>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear sale?"
          message="This removes all items from the current cart."
          confirmLabel="Clear"
          onConfirm={() => {
            clear()
            setConfirmClear(false)
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {discountOpen && (
        <DiscountModal
          subtotalCents={subtotalCents}
          current={discount}
          onApply={(d) => {
            setDiscount(d)
            setDiscountOpen(false)
          }}
          onRemove={() => {
            setDiscount(null)
            setDiscountOpen(false)
          }}
          onClose={() => setDiscountOpen(false)}
        />
      )}

      {paymentOpen && (
        <PaymentModal
          subtotalCents={subtotalCents}
          discountCents={manualDiscountCents}
          totalCents={totalCents}
          onClose={() => setPaymentOpen(false)}
        />
      )}
    </div>
  )
}
