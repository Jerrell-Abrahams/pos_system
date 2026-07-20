import { describe, expect, it } from 'vitest'
import { buildReceiptLines, type ReceiptData } from './receipt'

const BASE: ReceiptData = {
  businessName: 'The Thirsty Springbok',
  address: '12 Voortrekker Road, Paarl',
  businessNumber: '',
  receiptNo: 'R000001',
  createdAt: new Date(2026, 6, 11, 14, 5),
  cashierName: 'Lindiwe Dube',
  items: [{ productName: 'Castle Lager 340ml', qty: 2, unitPriceCents: 2800, lineTotalCents: 5600 }],
  subtotalCents: 5600,
  discountCents: 0,
  comboDiscountCents: 0,
  vatEnabled: true,
  vatRatePercent: 15,
  vatNumber: '4123456789',
  vatCents: 730,
  totalCents: 5600,
  payments: [{ method: 'cash', amountCents: 5600, tenderedCents: 6000, changeCents: 400 }],
  footer: 'Thank you for your visit.'
}

describe('buildReceiptLines', () => {
  it('includes business name, address, receipt number, and cashier', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('The Thirsty Springbok')
    expect(lines).toContain('12 Voortrekker Road, Paarl')
    expect(lines).toContain('Receipt: R000001')
    expect(lines).toContain('Cashier: Lindiwe Dube')
  })

  it('formats the date as DD/MM/YYYY HH:MM', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('Date: 11/07/2026 14:05')
  })

  it('prints the business number only when one is set', () => {
    expect(buildReceiptLines(BASE)).not.toContain('Business No: ')
    expect(buildReceiptLines({ ...BASE, businessNumber: '2019/123456/07' })).toContain('Business No: 2019/123456/07')
  })

  it('lists each item with qty, unit price, and line total', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('2 x Castle Lager 340ml')
    expect(lines).toContain('    R28.00 = R56.00')
  })

  it('omits the discount line when there is no discount', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines.some((l) => l.startsWith('Discount'))).toBe(false)
  })

  it('includes a discount line when a discount was applied', () => {
    const lines = buildReceiptLines({ ...BASE, discountCents: 500, totalCents: 5100 })
    expect(lines).toContain('Discount: -R5.00')
  })

  it('includes a promotions line when a combo discount was applied', () => {
    const lines = buildReceiptLines({ ...BASE, comboDiscountCents: 300, totalCents: 5300 })
    expect(lines).toContain('Promotions: -R3.00')
  })

  it('includes the VAT breakdown line when VAT is enabled', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('Total includes VAT @ 15%: R7.30')
  })

  it('omits the VAT line when VAT is disabled', () => {
    const lines = buildReceiptLines({ ...BASE, vatEnabled: false })
    expect(lines.some((l) => l.startsWith('Total includes VAT'))).toBe(false)
  })

  it('heads the receipt as a tax invoice with the VAT number when registered', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('VAT No: 4123456789')
    expect(lines).toContain('TAX INVOICE')
  })

  it('omits the tax invoice heading when no VAT number is set', () => {
    const lines = buildReceiptLines({ ...BASE, vatNumber: '' })
    expect(lines.some((l) => l.startsWith('VAT No'))).toBe(false)
    expect(lines).not.toContain('TAX INVOICE')
  })

  it('omits the tax invoice heading when VAT is off, even with a number on file', () => {
    const lines = buildReceiptLines({ ...BASE, vatEnabled: false })
    expect(lines.some((l) => l.startsWith('VAT No'))).toBe(false)
    expect(lines).not.toContain('TAX INVOICE')
  })

  it('shows tendered and change for a cash payment', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('  Tendered: R60.00')
    expect(lines).toContain('  Change: R4.00')
  })

  it('omits tendered/change for a card payment', () => {
    const lines = buildReceiptLines({
      ...BASE,
      payments: [{ method: 'card', amountCents: 5600, tenderedCents: null, changeCents: null }]
    })
    expect(lines.some((l) => l.includes('Tendered'))).toBe(false)
    expect(lines.some((l) => l.includes('Change'))).toBe(false)
  })

  it('names the card machine on the payment line when one took the payment', () => {
    const lines = buildReceiptLines({
      ...BASE,
      payments: [
        { method: 'card', amountCents: 5600, tenderedCents: null, changeCents: null, terminal: 'Capitec NEW9220' }
      ]
    })
    expect(lines).toContain('Payment (card - Capitec NEW9220): R56.00')
  })

  it('leaves the payment line unchanged when no card machine is recorded', () => {
    const lines = buildReceiptLines({
      ...BASE,
      payments: [{ method: 'card', amountCents: 5600, tenderedCents: null, changeCents: null, terminal: null }]
    })
    expect(lines).toContain('Payment (card): R56.00')
  })

  it('includes the footer text', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines).toContain('Thank you for your visit.')
  })

  it('omits the voided marker for a normal sale', () => {
    const lines = buildReceiptLines(BASE)
    expect(lines.some((l) => l.includes('VOIDED'))).toBe(false)
  })

  it('includes a voided marker when the sale was voided', () => {
    const lines = buildReceiptLines({ ...BASE, voided: true })
    expect(lines).toContain('*** VOIDED — NOT VALID ***')
  })
})
