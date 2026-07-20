import { useState } from 'react'
import { calcChangeCents, formatRands } from '@shared/money'
import type { CreateSaleResult, PaymentInput, PaymentMethod } from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { cartComboItemsAsSaleItems, useCartStore } from '../../stores/cartStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { useProductsStore } from '../../stores/productsStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Keypad } from '../common/Keypad'
import { SplitPaymentBuilder } from './SplitPaymentBuilder'

interface PaymentModalProps {
  subtotalCents: number
  discountCents: number
  totalCents: number
  onClose: () => void
}

type Stage =
  | { kind: 'choose' }
  | { kind: 'cash' }
  | { kind: 'pick-terminal' }
  | { kind: 'card-eft'; method: 'card' | 'eft'; terminal?: string }
  | { kind: 'split' }

const QUICK_AMOUNTS_CENTS = [5000, 10000, 20000]
const MAX_TENDERED_CENTS = 99999900
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', card: 'Card', eft: 'EFT' }

export function PaymentModal({ discountCents, totalCents, onClose }: PaymentModalProps): React.JSX.Element {
  const employee = useAuthStore((s) => s.employee)
  const lines = useCartStore((s) => s.lines)
  const comboLines = useCartStore((s) => s.comboLines)
  const discount = useCartStore((s) => s.discount)
  const clearCart = useCartStore((s) => s.clear)
  const cardTerminals = useSettingsStore((s) => s.cardTerminals)
  const reloadCatalog = useCatalogStore((s) => s.load)
  const reloadProducts = useProductsStore((s) => s.load)

  const [stage, setStage] = useState<Stage>({ kind: 'choose' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateSaleResult | null>(null)

  async function submitPayments(payments: PaymentInput[]): Promise<void> {
    if (!employee || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const saleResult = await window.api.sales.create({
        employeeId: employee.id,
        items: [...lines.map((l) => ({ productId: l.productId, qty: l.qty })), ...cartComboItemsAsSaleItems(comboLines)],
        payments,
        discount: discountCents > 0 ? { amountCents: discountCents, authorizedBy: discount?.authorizedBy ?? null } : undefined,
        combos: comboLines.map((c) => ({ comboId: c.comboId, qty: c.qty }))
      })
      setResult(saleResult)
      // Stock quantities just changed under products/catalog's feet — both are fetch-once
      // stores with no other signal that a sale happened, so they'd otherwise keep showing
      // pre-sale stock until an unrelated edit elsewhere happened to reload them.
      void reloadCatalog()
      void reloadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete sale')
      setStage({ kind: 'choose' })
    } finally {
      setSubmitting(false)
    }
  }

  function finish(): void {
    clearCart()
    onClose()
  }

  if (result) {
    return (
      <Frame>
        <div className="text-center">
          <p className="text-sm text-ink-muted">Sale complete · {result.receiptNo}</p>
          <p className="mt-2 text-sm text-ink-muted">Change due</p>
          <p className="text-5xl font-semibold text-accent-light">{formatRands(result.changeCents)}</p>
          <button
            type="button"
            onClick={finish}
            className="mt-6 h-16 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light"
          >
            New Sale
          </button>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      <div className="text-center">
        <p className="text-sm text-ink-muted">Total due</p>
        <p className="text-4xl font-semibold text-ink">{formatRands(totalCents)}</p>
      </div>

      <div className="mt-5">
        {stage.kind === 'choose' && (
          <div className="grid grid-cols-2 gap-3">
            <MethodButton label="Cash" onClick={() => setStage({ kind: 'cash' })} />
            <MethodButton
              label="Card"
              onClick={() =>
                setStage(cardTerminals.length > 0 ? { kind: 'pick-terminal' } : { kind: 'card-eft', method: 'card' })
              }
            />
            <MethodButton label="EFT" onClick={() => setStage({ kind: 'card-eft', method: 'eft' })} />
            <MethodButton label="Split" onClick={() => setStage({ kind: 'split' })} />
          </div>
        )}

        {stage.kind === 'cash' && (
          <CashStage
            totalCents={totalCents}
            submitting={submitting}
            onBack={() => setStage({ kind: 'choose' })}
            onConfirm={(tenderedCents, changeCents) =>
              void submitPayments([{ method: 'cash', amountCents: totalCents, tenderedCents, changeCents }])
            }
          />
        )}

        {stage.kind === 'pick-terminal' && (
          <div>
            <p className="text-center text-sm text-ink-muted">Which card machine?</p>
            <div className="mt-3 space-y-2">
              {cardTerminals.map((terminal) => (
                <button
                  key={terminal}
                  type="button"
                  onClick={() => setStage({ kind: 'card-eft', method: 'card', terminal })}
                  className="h-16 w-full rounded-xl border border-border bg-bg px-4 text-base font-semibold text-ink active:border-accent-border active:bg-accent-tint"
                >
                  {terminal}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStage({ kind: 'choose' })}
              className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
            >
              Back
            </button>
          </div>
        )}

        {stage.kind === 'card-eft' && (
          <CardEftStage
            method={stage.method}
            terminal={stage.terminal}
            totalCents={totalCents}
            submitting={submitting}
            onBack={() => setStage(stage.terminal ? { kind: 'pick-terminal' } : { kind: 'choose' })}
            onConfirm={() =>
              void submitPayments([{ method: stage.method, amountCents: totalCents, terminal: stage.terminal }])
            }
          />
        )}

        {stage.kind === 'split' && (
          <SplitPaymentBuilder
            totalCents={totalCents}
            onCancel={() => setStage({ kind: 'choose' })}
            onComplete={(payments) => void submitPayments(payments)}
          />
        )}
      </div>

      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

      {stage.kind === 'choose' && (
        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
        >
          Cancel
        </button>
      )}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[420px] rounded-2xl border border-border bg-surface p-6">{children}</div>
    </div>
  )
}

function MethodButton({ label, onClick }: { label: string; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-20 rounded-xl border border-border bg-bg text-lg font-semibold text-ink active:border-accent-border active:bg-accent-tint"
    >
      {label}
    </button>
  )
}

function CashStage({
  totalCents,
  submitting,
  onBack,
  onConfirm
}: {
  totalCents: number
  submitting: boolean
  onBack: () => void
  onConfirm: (tenderedCents: number, changeCents: number) => void
}): React.JSX.Element {
  const [tenderedCents, setTenderedCents] = useState(0)
  const changeCents = calcChangeCents(tenderedCents, totalCents)

  function handleDigit(digit: string): void {
    setTenderedCents((cents) => Math.min(cents * 10 + Number(digit), MAX_TENDERED_CENTS))
  }

  function handleBackspace(): void {
    setTenderedCents((cents) => Math.floor(cents / 10))
  }

  return (
    <div>
      <div className="rounded-xl border border-border bg-bg p-4 text-center">
        <p className="text-xs text-ink-muted">Tendered</p>
        <p className="text-2xl font-medium text-ink">{formatRands(tenderedCents)}</p>
        <p className={`mt-1 text-sm ${changeCents < 0 ? 'text-danger' : 'text-success'}`}>
          {changeCents < 0 ? `Short ${formatRands(-changeCents)}` : `Change ${formatRands(changeCents)}`}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS_CENTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setTenderedCents(amount)}
            className="h-14 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            {formatRands(amount)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTenderedCents(totalCents)}
          className="h-14 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
        >
          Exact
        </button>
      </div>

      <div className="mt-4">
        <Keypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onSubmit={() => onConfirm(tenderedCents, changeCents)}
          submitLabel={submitting ? 'Processing…' : 'Confirm'}
          submitDisabled={changeCents < 0 || submitting}
        />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
      >
        Back
      </button>
    </div>
  )
}

function CardEftStage({
  method,
  terminal,
  totalCents,
  submitting,
  onBack,
  onConfirm
}: {
  method: 'card' | 'eft'
  terminal?: string
  totalCents: number
  submitting: boolean
  onBack: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <div className="text-center">
      <p className="text-sm text-ink-muted">
        Take payment of {formatRands(totalCents)} on {terminal ?? `the ${METHOD_LABEL[method]} terminal`}, then
        confirm.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={submitting}
        className="mt-5 h-16 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light disabled:opacity-40"
      >
        {submitting ? 'Processing…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
      >
        Back
      </button>
    </div>
  )
}
