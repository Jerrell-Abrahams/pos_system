import { formatRands } from './money'

export interface ReceiptItem {
  productName: string
  qty: number
  unitPriceCents: number
  lineTotalCents: number
}

export interface ReceiptPayment {
  method: string
  amountCents: number
  tenderedCents: number | null
  changeCents: number | null
  terminal?: string | null
}

export interface ReceiptData {
  businessName: string
  address: string
  businessNumber: string
  receiptNo: string
  createdAt: Date
  cashierName: string
  items: ReceiptItem[]
  subtotalCents: number
  discountCents: number
  comboDiscountCents: number
  vatEnabled: boolean
  vatRatePercent: number
  vatNumber: string
  vatCents: number
  totalCents: number
  payments: ReceiptPayment[]
  footer: string
  voided?: boolean
}

const RULE = '--------------------------------'

export function formatDateTime(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function buildReceiptLines(data: ReceiptData): string[] {
  const lines: string[] = []

  // A document may only be headed "Tax Invoice" if it carries the vendor's VAT number, so the
  // heading and the number are gated together — a VAT-registered shop that hasn't filled the
  // number in yet prints a plain slip rather than an invalid tax invoice.
  const taxInvoice = data.vatEnabled && data.vatNumber.trim().length > 0

  lines.push(data.businessName)
  if (data.address) lines.push(data.address)
  if (data.businessNumber.trim()) lines.push(`Business No: ${data.businessNumber.trim()}`)
  if (taxInvoice) lines.push(`VAT No: ${data.vatNumber.trim()}`)
  lines.push(RULE)
  if (taxInvoice) lines.push('TAX INVOICE')
  lines.push(`Receipt: ${data.receiptNo}`)
  lines.push(`Date: ${formatDateTime(data.createdAt)}`)
  lines.push(`Cashier: ${data.cashierName}`)
  lines.push(RULE)
  if (data.voided) lines.push('*** VOIDED — NOT VALID ***')

  for (const item of data.items) {
    lines.push(`${item.qty} x ${item.productName}`)
    lines.push(`    ${formatRands(item.unitPriceCents)} = ${formatRands(item.lineTotalCents)}`)
  }
  lines.push(RULE)

  lines.push(`Subtotal: ${formatRands(data.subtotalCents)}`)
  if (data.discountCents > 0) lines.push(`Discount: -${formatRands(data.discountCents)}`)
  if (data.comboDiscountCents > 0) lines.push(`Promotions: -${formatRands(data.comboDiscountCents)}`)
  if (data.comboDiscountCents < 0) lines.push(`Combo adjustment: +${formatRands(-data.comboDiscountCents)}`)
  lines.push(`Total: ${formatRands(data.totalCents)}`)
  if (data.vatEnabled) {
    lines.push(`Total includes VAT @ ${data.vatRatePercent}%: ${formatRands(data.vatCents)}`)
  }
  lines.push(RULE)

  for (const payment of data.payments) {
    const method = payment.terminal ? `${payment.method} - ${payment.terminal}` : payment.method
    lines.push(`Payment (${method}): ${formatRands(payment.amountCents)}`)
    if (payment.tenderedCents != null) lines.push(`  Tendered: ${formatRands(payment.tenderedCents)}`)
    if (payment.changeCents != null && payment.changeCents > 0) {
      lines.push(`  Change: ${formatRands(payment.changeCents)}`)
    }
  }
  lines.push(RULE)

  if (data.footer) lines.push(data.footer)

  return lines
}
