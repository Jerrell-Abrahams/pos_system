export function formatRands(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const rands = Math.floor(abs / 100)
  const decimals = String(abs % 100).padStart(2, '0')
  const withThousands = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${negative ? '-' : ''}R${withThousands}.${decimals}`
}

// Whole-rand form for plain-language copy (e.g. insight cards) where cents read as noise.
// Rounds to the nearest rand first (not truncate) so R199 reads as R2, not R1.
export function formatRandsWhole(cents: number): string {
  return formatRands(Math.round(cents / 100) * 100).replace(/\.\d{2}$/, '')
}

export function calcInclusiveVatCents(inclusiveTotalCents: number, vatRatePercent: number): number {
  return Math.round((inclusiveTotalCents * vatRatePercent) / (100 + vatRatePercent))
}

export function calcChangeCents(tenderedCents: number, totalCents: number): number {
  return tenderedCents - totalCents
}

export interface DiscountConfig {
  type: 'fixed' | 'percent'
  value: number
}

export function calcDiscountCents(subtotalCents: number, discount: DiscountConfig | null): number {
  if (!discount) return 0
  const raw =
    discount.type === 'percent' ? Math.round((subtotalCents * discount.value) / 100) : Math.round(discount.value)
  return Math.max(0, Math.min(raw, subtotalCents))
}

export function discountExceedsThreshold(
  discountCents: number,
  subtotalCents: number,
  thresholdPercent: number
): boolean {
  if (subtotalCents <= 0 || discountCents <= 0) return false
  return (discountCents / subtotalCents) * 100 > thresholdPercent
}

export function calcPaymentsCoveredCents(payments: { amountCents: number }[]): number {
  return payments.reduce((sum, p) => sum + p.amountCents, 0)
}

export function calcRemainingCents(totalCents: number, payments: { amountCents: number }[]): number {
  return totalCents - calcPaymentsCoveredCents(payments)
}
