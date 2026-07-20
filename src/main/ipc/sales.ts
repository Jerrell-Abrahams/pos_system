import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import {
  calcDiscountCents,
  calcInclusiveVatCents,
  calcPaymentsCoveredCents,
  calcRemainingCents,
  discountExceedsThreshold
} from '@shared/money'
import { parseDbTimestamp } from '@shared/dates'
import { buildReceiptLines, type ReceiptData } from '@shared/receipt'
import { isEntitledSync } from '../lib/license'
import type {
  ComboApplication,
  CreateSaleInput,
  CreateSaleResult,
  PaymentMethod,
  SaleDetail,
  SaleListItem,
  SaleStatus,
  TestActionResult,
  VoidSaleInput
} from '@shared/types'
import { logAudit } from '../lib/auditLog'
import { insertOutbox } from '../lib/outbox'
import { enqueuePrint } from '../lib/printQueue'
import { requireRealEmployee } from '../lib/superUser'

interface ProductRow {
  id: number
  name: string
  sell_price_cents: number
}

interface TillRow {
  id: number
  till_device_id: string
}

interface SaleHeaderRow {
  id: number
  receipt_no: string
  created_at: string
  status: SaleStatus
  void_reason: string | null
  subtotal_cents: number
  discount_cents: number
  combo_discount_cents: number
  vat_cents: number
  total_cents: number
  cashier_name: string
}

interface SaleItemRow {
  product_name: string
  qty: number
  unit_price_cents: number
  line_total_cents: number
}

interface PaymentRow {
  method: PaymentMethod
  amount_cents: number
  tendered_cents: number | null
  change_cents: number | null
  terminal: string | null
}

// Combo prices are pre-approved by whoever set up the promotion, so this discount never
// goes through the manual-discount manager-authorization threshold — only its own combo
// definition. Recomputed from the DB, not trusted from the renderer.
function calcComboDiscountCents(
  db: Database.Database,
  combos: ComboApplication[],
  items: { productId: number; qty: number }[]
): number {
  let comboDiscountCents = 0
  for (const application of combos) {
    if (application.qty <= 0) throw new Error('Combo quantity must be positive')
    const combo = db.prepare('SELECT id, price_cents FROM combos WHERE id = ? AND active = 1').get(application.comboId) as
      | { id: number; price_cents: number }
      | undefined
    if (!combo) throw new Error(`Combo ${application.comboId} not found or inactive`)

    const comboItems = db.prepare('SELECT product_id, qty FROM combo_items WHERE combo_id = ?').all(combo.id) as {
      product_id: number
      qty: number
    }[]

    let componentsCents = 0
    for (const comboItem of comboItems) {
      const requiredQty = comboItem.qty * application.qty
      const suppliedQty = items.filter((i) => i.productId === comboItem.product_id).reduce((s, i) => s + i.qty, 0)
      if (suppliedQty < requiredQty) {
        throw new Error(`Cart is missing items required by a combo (product ${comboItem.product_id})`)
      }
      const product = db.prepare('SELECT sell_price_cents FROM products WHERE id = ?').get(comboItem.product_id) as
        | { sell_price_cents: number }
        | undefined
      if (!product) throw new Error(`Product ${comboItem.product_id} not found`)
      componentsCents += product.sell_price_cents * requiredQty
    }

    // Not clamped to >= 0: a combo priced above its parts' combined price must still charge
    // exactly the combo's set price, not silently fall back to the cheaper components total.
    comboDiscountCents += componentsCents - combo.price_cents * application.qty
  }
  return comboDiscountCents
}

function getSaleDetail(db: Database.Database, saleId: number): SaleDetail {
  const sale = db
    .prepare(
      `SELECT s.id, s.receipt_no, s.created_at, s.status, s.void_reason,
              s.subtotal_cents, s.discount_cents, s.combo_discount_cents, s.vat_cents, s.total_cents,
              e.name AS cashier_name
       FROM sales s JOIN employees e ON e.id = s.employee_id WHERE s.id = ?`
    )
    .get(saleId) as SaleHeaderRow | undefined
  if (!sale) throw new Error('Sale not found')

  const items = db
    .prepare('SELECT product_name, qty, unit_price_cents, line_total_cents FROM sale_items WHERE sale_id = ?')
    .all(saleId) as SaleItemRow[]

  const payments = db
    .prepare('SELECT method, amount_cents, tendered_cents, change_cents, terminal FROM payments WHERE sale_id = ?')
    .all(saleId) as PaymentRow[]

  return {
    id: sale.id,
    receiptNo: sale.receipt_no,
    createdAt: sale.created_at,
    cashierName: sale.cashier_name,
    status: sale.status,
    voidReason: sale.void_reason,
    items: items.map((i) => ({
      productName: i.product_name,
      qty: i.qty,
      unitPriceCents: i.unit_price_cents,
      lineTotalCents: i.line_total_cents
    })),
    payments: payments.map((p) => ({
      method: p.method,
      amountCents: p.amount_cents,
      tenderedCents: p.tendered_cents,
      changeCents: p.change_cents,
      terminal: p.terminal
    })),
    subtotalCents: sale.subtotal_cents,
    discountCents: sale.discount_cents,
    comboDiscountCents: sale.combo_discount_cents,
    vatCents: sale.vat_cents,
    totalCents: sale.total_cents
  }
}

export function registerSalesHandlers(db: Database.Database): void {
  ipcMain.handle('sales:create', (_event, input: CreateSaleInput): CreateSaleResult => {
    if (!isEntitledSync(db)) throw new Error('Subscription inactive')
    requireRealEmployee(input.employeeId)
    if (input.items.length === 0) throw new Error('Cannot create a sale with no items')
    if (input.payments.length === 0) throw new Error('Cannot create a sale with no payments')

    const till = db.prepare(`SELECT id, till_device_id FROM tills WHERE status = 'open'`).get() as
      | TillRow
      | undefined
    if (!till) throw new Error('No open till')

    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]))
    const vatEnabled = settingsMap.get('vat_enabled') === 'true'
    const vatRatePercent = Number(settingsMap.get('vat_rate') ?? '15')
    const discountThresholdPercent = Number(settingsMap.get('discount_threshold_percent') ?? '20')

    const productStmt = db.prepare('SELECT id, name, sell_price_cents FROM products WHERE id = ?')
    const items = input.items.map((item) => {
      const product = productStmt.get(item.productId) as ProductRow | undefined
      if (!product) throw new Error(`Product ${item.productId} not found`)
      return { product, qty: item.qty }
    })

    const subtotalCents = items.reduce((sum, i) => sum + i.product.sell_price_cents * i.qty, 0)
    const discountCents = calcDiscountCents(subtotalCents, input.discount ? { type: 'fixed', value: input.discount.amountCents } : null)

    if (discountExceedsThreshold(discountCents, subtotalCents, discountThresholdPercent)) {
      const authorizedBy = input.discount?.authorizedBy
      if (!authorizedBy) throw new Error('Discount exceeds threshold and requires manager authorization')
      const manager = db
        .prepare(`SELECT id FROM employees WHERE id = ? AND role = 'manager' AND active = 1`)
        .get(authorizedBy)
      if (!manager) throw new Error('Discount authorization must come from an active manager')
    }

    const comboDiscountCents = calcComboDiscountCents(db, input.combos ?? [], input.items)
    const totalCents = subtotalCents - discountCents - comboDiscountCents
    const vatCents = vatEnabled ? calcInclusiveVatCents(totalCents, vatRatePercent) : 0

    // Re-derived here rather than trusted from the renderer: `terminal` is what end-of-day
    // reconciliation against each machine's settlement report is grouped by, so a typo'd or
    // stale name would quietly split one machine's takings into two.
    const cardTerminals = (settingsMap.get('card_terminals') ?? '')
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t !== '')

    for (const payment of input.payments) {
      if (payment.amountCents <= 0) throw new Error('Each payment must be for a positive amount')
      if (payment.terminal != null) {
        if (payment.method !== 'card') throw new Error('Only a card payment can name a terminal')
        if (!cardTerminals.includes(payment.terminal)) throw new Error(`Unknown card terminal: ${payment.terminal}`)
      } else if (payment.method === 'card' && cardTerminals.length > 0) {
        throw new Error('Card payments must name which terminal took them')
      }
    }
    const coveredCents = calcPaymentsCoveredCents(input.payments)
    if (calcRemainingCents(totalCents, input.payments) !== 0) {
      throw new Error(`Payments (${coveredCents}c) do not cover the total (${totalCents}c)`)
    }

    const createSale = db.transaction((): CreateSaleResult => {
      // Global, not per-till: receipt_no carries a table-wide UNIQUE constraint, and a second
      // till reusing R000001 would collide with the first till's receipt of the same number.
      const lastReceipt = db.prepare('SELECT receipt_no FROM sales ORDER BY id DESC LIMIT 1').get() as
        | { receipt_no: string }
        | undefined
      const nextSeq = lastReceipt ? Number(lastReceipt.receipt_no.replace('R', '')) + 1 : 1
      const receiptNo = `R${String(nextSeq).padStart(6, '0')}`
      const discountAuthorizedBy = discountCents > 0 ? (input.discount?.authorizedBy ?? null) : null

      const saleId = Number(
        db
          .prepare(
            `INSERT INTO sales
              (receipt_no, till_id, till_device_id, employee_id, subtotal_cents, discount_cents,
               discount_authorized_by, combo_discount_cents, vat_cents, total_cents, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`
          )
          .run(
            receiptNo,
            till.id,
            till.till_device_id,
            input.employeeId,
            subtotalCents,
            discountCents,
            discountAuthorizedBy,
            comboDiscountCents,
            vatCents,
            totalCents
          ).lastInsertRowid
      )
      insertOutbox(db, 'sales', saleId, 'insert', {
        id: saleId,
        receipt_no: receiptNo,
        till_id: till.id,
        till_device_id: till.till_device_id,
        employee_id: input.employeeId,
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        discount_authorized_by: discountAuthorizedBy,
        combo_discount_cents: comboDiscountCents,
        vat_cents: vatCents,
        total_cents: totalCents,
        status: 'completed'
      })

      const insertItem = db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      const insertStockMove = db.prepare(
        `INSERT INTO stock_moves (till_device_id, product_id, type, qty, employee_id)
         VALUES (?, ?, 'sale', ?, ?)`
      )
      const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?')

      for (const { product, qty } of items) {
        const lineTotalCents = product.sell_price_cents * qty
        const itemId = Number(
          insertItem.run(saleId, product.id, product.name, qty, product.sell_price_cents, lineTotalCents)
            .lastInsertRowid
        )
        insertOutbox(db, 'sale_items', itemId, 'insert', {
          id: itemId,
          sale_id: saleId,
          product_id: product.id,
          product_name: product.name,
          qty,
          unit_price_cents: product.sell_price_cents,
          line_total_cents: lineTotalCents
        })

        const moveId = Number(
          insertStockMove.run(till.till_device_id, product.id, -qty, input.employeeId).lastInsertRowid
        )
        insertOutbox(db, 'stock_moves', moveId, 'insert', {
          id: moveId,
          till_device_id: till.till_device_id,
          product_id: product.id,
          type: 'sale',
          qty: -qty,
          employee_id: input.employeeId
        })

        updateStock.run(qty, product.id)
        insertOutbox(db, 'products', product.id, 'update', { id: product.id, stock_qty_delta: -qty })
      }

      const insertPayment = db.prepare(
        `INSERT INTO payments (sale_id, method, amount_cents, tendered_cents, change_cents, terminal)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      let changeCents = 0
      for (const payment of input.payments) {
        const paymentId = Number(
          insertPayment.run(
            saleId,
            payment.method,
            payment.amountCents,
            payment.tenderedCents ?? null,
            payment.changeCents ?? null,
            payment.terminal ?? null
          ).lastInsertRowid
        )
        insertOutbox(db, 'payments', paymentId, 'insert', {
          id: paymentId,
          sale_id: saleId,
          method: payment.method,
          amount_cents: payment.amountCents,
          tendered_cents: payment.tenderedCents ?? null,
          change_cents: payment.changeCents ?? null,
          terminal: payment.terminal ?? null
        })
        changeCents += payment.changeCents ?? 0
      }

      logAudit(db, {
        employeeId: input.employeeId,
        action: 'sale.create',
        entityType: 'sale',
        entityId: saleId,
        details: { receiptNo, totalCents, itemCount: items.length }
      })

      return { saleId, receiptNo, totalCents, vatCents, changeCents }
    })

    const result = createSale()

    // Printing happens strictly after the transaction above has committed, so a printer
    // issue (or a bug in receipt formatting) can never affect the sale that already saved.
    try {
      const employee = db.prepare('SELECT name FROM employees WHERE id = ?').get(input.employeeId) as
        | { name: string }
        | undefined

      const receiptData: ReceiptData = {
        businessName: settingsMap.get('business_name') ?? '',
        address: settingsMap.get('business_address') ?? '',
        businessNumber: settingsMap.get('business_number') ?? '',
        receiptNo: result.receiptNo,
        createdAt: new Date(),
        cashierName: employee?.name ?? 'Unknown',
        items: items.map(({ product, qty }) => ({
          productName: product.name,
          qty,
          unitPriceCents: product.sell_price_cents,
          lineTotalCents: product.sell_price_cents * qty
        })),
        subtotalCents,
        discountCents,
        comboDiscountCents,
        vatEnabled,
        vatRatePercent,
        vatNumber: settingsMap.get('vat_number') ?? '',
        vatCents,
        totalCents,
        payments: input.payments.map((p) => ({
          method: p.method,
          amountCents: p.amountCents,
          tenderedCents: p.tenderedCents ?? null,
          changeCents: p.changeCents ?? null,
          terminal: p.terminal ?? null
        })),
        footer: settingsMap.get('receipt_footer') ?? ''
      }

      const kickDrawer = input.payments.some((p) => p.method === 'cash')
      enqueuePrint(result.receiptNo, buildReceiptLines(receiptData), kickDrawer)
    } catch (err) {
      console.error('Failed to queue receipt print:', err)
    }

    return result
  })

  ipcMain.handle('sales:list', (_event, date: string, search: string): SaleListItem[] => {
    const q = search.trim()
    const rows = db
      .prepare(
        `SELECT s.id, s.receipt_no, s.created_at, s.total_cents, s.status, e.name AS cashier_name
         FROM sales s JOIN employees e ON e.id = s.employee_id
         WHERE date(s.created_at, 'localtime') = ?
           AND (? = '' OR s.receipt_no LIKE '%'||?||'%' OR e.name LIKE '%'||?||'%')
         ORDER BY s.created_at DESC`
      )
      .all(date, q, q, q) as (SaleHeaderRow & { total_cents: number })[]

    return rows.map((r) => ({
      id: r.id,
      receiptNo: r.receipt_no,
      createdAt: r.created_at,
      cashierName: r.cashier_name,
      totalCents: r.total_cents,
      status: r.status
    }))
  })

  ipcMain.handle('sales:detail', (_event, saleId: number): SaleDetail => getSaleDetail(db, saleId))

  ipcMain.handle('sales:void', (_event, input: VoidSaleInput): SaleDetail => {
    const reason = input.reason.trim()
    if (!reason) throw new Error('A reason is required to void a sale')

    // Deliberately NOT lib/requireManager: that one lets the super user through, and
    // voided_by is a foreign key to employees(id) the super user has no row in. Keeping
    // the check inline blocks it here with an authorization error rather than a foreign
    // key failure halfway through the void.
    const manager = db
      .prepare(`SELECT id FROM employees WHERE id = ? AND role = 'manager' AND active = 1`)
      .get(input.authorizedBy)
    if (!manager) throw new Error('Manager authorization required')

    const sale = db.prepare('SELECT id, status, till_device_id FROM sales WHERE id = ?').get(input.saleId) as
      | { id: number; status: SaleStatus; till_device_id: string }
      | undefined
    if (!sale) throw new Error('Sale not found')
    if (sale.status !== 'completed') throw new Error('Only a completed sale can be voided')

    const items = db.prepare('SELECT product_id, qty FROM sale_items WHERE sale_id = ?').all(input.saleId) as {
      product_id: number
      qty: number
    }[]

    const voidSale = db.transaction((): void => {
      db.prepare(`UPDATE sales SET status = 'voided', voided_by = ?, void_reason = ? WHERE id = ?`).run(
        input.authorizedBy,
        reason,
        input.saleId
      )
      insertOutbox(db, 'sales', input.saleId, 'update', {
        id: input.saleId,
        status: 'voided',
        voided_by: input.authorizedBy,
        void_reason: reason
      })

      const restoreStock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?')
      const insertMove = db.prepare(
        `INSERT INTO stock_moves (till_device_id, product_id, type, qty, reason, employee_id)
         VALUES (?, ?, 'refund', ?, ?, ?)`
      )
      for (const item of items) {
        restoreStock.run(item.qty, item.product_id)
        const moveReason = `Void ${input.saleId}: ${reason}`
        const moveId = Number(
          insertMove.run(sale.till_device_id, item.product_id, item.qty, moveReason, input.authorizedBy)
            .lastInsertRowid
        )
        insertOutbox(db, 'stock_moves', moveId, 'insert', {
          id: moveId,
          till_device_id: sale.till_device_id,
          product_id: item.product_id,
          type: 'refund',
          qty: item.qty,
          reason: moveReason,
          employee_id: input.authorizedBy
        })
        insertOutbox(db, 'products', item.product_id, 'update', {
          id: item.product_id,
          stock_qty_delta: item.qty
        })
      }

      logAudit(db, {
        employeeId: input.authorizedBy,
        action: 'sale.void',
        entityType: 'sale',
        entityId: input.saleId,
        details: { reason }
      })
    })

    voidSale()
    return getSaleDetail(db, input.saleId)
  })

  ipcMain.handle('sales:reprint', (_event, saleId: number): TestActionResult => {
    try {
      const detail = getSaleDetail(db, saleId)
      const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
      const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]))

      const receiptData: ReceiptData = {
        businessName: settingsMap.get('business_name') ?? '',
        address: settingsMap.get('business_address') ?? '',
        businessNumber: settingsMap.get('business_number') ?? '',
        receiptNo: detail.receiptNo,
        createdAt: parseDbTimestamp(detail.createdAt),
        cashierName: detail.cashierName,
        items: detail.items,
        subtotalCents: detail.subtotalCents,
        discountCents: detail.discountCents,
        comboDiscountCents: detail.comboDiscountCents,
        vatEnabled: settingsMap.get('vat_enabled') === 'true',
        vatRatePercent: Number(settingsMap.get('vat_rate') ?? '15'),
        vatNumber: settingsMap.get('vat_number') ?? '',
        vatCents: detail.vatCents,
        totalCents: detail.totalCents,
        payments: detail.payments,
        footer: settingsMap.get('receipt_footer') ?? '',
        voided: detail.status === 'voided'
      }

      // Reprints never kick the drawer — no new cash is changing hands.
      enqueuePrint(detail.receiptNo, buildReceiptLines(receiptData), false)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not reprint receipt' }
    }
  })
}
