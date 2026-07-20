import { describe, expect, it } from 'vitest'
import {
  calcChangeCents,
  calcDiscountCents,
  calcInclusiveVatCents,
  calcPaymentsCoveredCents,
  calcRemainingCents,
  discountExceedsThreshold,
  formatRands
} from './money'

describe('formatRands', () => {
  it('formats thousands with a space separator', () => {
    expect(formatRands(123450)).toBe('R1 234.50')
  })
  it('formats zero', () => {
    expect(formatRands(0)).toBe('R0.00')
  })
  it('formats sub-hundred amounts', () => {
    expect(formatRands(500)).toBe('R5.00')
  })
  it('formats negative amounts', () => {
    expect(formatRands(-1500)).toBe('-R15.00')
  })
})

describe('calcInclusiveVatCents', () => {
  it('extracts VAT from a VAT-inclusive total', () => {
    expect(calcInclusiveVatCents(11500, 15)).toBe(1500)
  })
  it('rounds small amounts correctly', () => {
    expect(calcInclusiveVatCents(100, 15)).toBe(13)
  })
})

describe('calcChangeCents', () => {
  it('computes change for sufficient tender', () => {
    expect(calcChangeCents(15000, 11500)).toBe(3500)
  })
  it('goes negative for insufficient tender', () => {
    expect(calcChangeCents(10000, 11500)).toBe(-1500)
  })
})

describe('calcDiscountCents', () => {
  it('returns 0 when no discount is set', () => {
    expect(calcDiscountCents(10000, null)).toBe(0)
  })
  it('computes a percentage discount', () => {
    expect(calcDiscountCents(10000, { type: 'percent', value: 20 })).toBe(2000)
  })
  it('computes a fixed discount', () => {
    expect(calcDiscountCents(10000, { type: 'fixed', value: 1500 })).toBe(1500)
  })
  it('clamps a discount so it cannot exceed the subtotal', () => {
    expect(calcDiscountCents(10000, { type: 'fixed', value: 50000 })).toBe(10000)
  })
  it('clamps a negative discount to zero', () => {
    expect(calcDiscountCents(10000, { type: 'fixed', value: -500 })).toBe(0)
  })
})

describe('discountExceedsThreshold', () => {
  it('is false for a discount at or under the threshold', () => {
    expect(discountExceedsThreshold(2000, 10000, 20)).toBe(false)
  })
  it('is true for a discount over the threshold', () => {
    expect(discountExceedsThreshold(2001, 10000, 20)).toBe(true)
  })
  it('is false when there is no discount', () => {
    expect(discountExceedsThreshold(0, 10000, 20)).toBe(false)
  })
})

describe('split-payment coverage', () => {
  it('sums covered amounts across payment lines', () => {
    expect(calcPaymentsCoveredCents([{ amountCents: 10000 }, { amountCents: 9600 }])).toBe(19600)
  })
  it('computes remaining due as payments are added', () => {
    expect(calcRemainingCents(19600, [{ amountCents: 10000 }])).toBe(9600)
  })
  it('remaining hits zero once fully covered', () => {
    expect(calcRemainingCents(19600, [{ amountCents: 10000 }, { amountCents: 9600 }])).toBe(0)
  })
  it('remaining goes negative if overpaid across lines', () => {
    expect(calcRemainingCents(19600, [{ amountCents: 15000 }, { amountCents: 9600 }])).toBe(-5000)
  })
})
