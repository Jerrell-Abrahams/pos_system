import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type {
  AnalyticsPeriod,
  CashFlowSummary,
  DateRange,
  Expense,
  ExpenseCreateInput,
  InventoryValuationItem,
  InventoryValuationSummary,
  ProductPerformanceItem,
  ProfitSummary,
  SalesByPeriodPoint
} from '@shared/types'
import { insertOutbox } from '../lib/outbox'
import { requireRealEmployee } from '../lib/superUser'

const PERIOD_FORMAT: Record<AnalyticsPeriod, string> = {
  day: '%Y-%m-%d',
  week: '%Y-W%W',
  month: '%Y-%m',
  year: '%Y'
}

const PERIOD_LIMIT: Record<AnalyticsPeriod, number> = { day: 30, week: 12, month: 12, year: 5 }

export function registerAnalyticsHandlers(db: Database.Database): void {
  ipcMain.handle('analytics:salesByPeriod', (_event, period: AnalyticsPeriod): SalesByPeriodPoint[] => {
    const rows = db
      .prepare(
        `SELECT strftime(?, created_at, 'localtime') AS period,
                COUNT(*) AS count, COALESCE(SUM(total_cents), 0) AS total
         FROM sales WHERE status = 'completed'
         GROUP BY period ORDER BY period DESC LIMIT ?`
      )
      .all(PERIOD_FORMAT[period], PERIOD_LIMIT[period]) as { period: string; count: number; total: number }[]

    return rows.reverse().map((r) => ({ period: r.period, salesCount: r.count, totalCents: r.total }))
  })

  ipcMain.handle(
    'analytics:productPerformance',
    (_event, range: DateRange): ProductPerformanceItem[] => {
      const rows = db
        .prepare(
          `SELECT p.id AS product_id, p.name AS product_name,
                  COALESCE(SUM(si.qty), 0) AS qty_sold, COALESCE(SUM(si.line_total_cents), 0) AS revenue_cents
           FROM products p
           LEFT JOIN sale_items si ON si.product_id = p.id
             AND si.sale_id IN (
               SELECT id FROM sales WHERE status = 'completed' AND date(created_at, 'localtime') BETWEEN ? AND ?
             )
           WHERE p.active = 1
           GROUP BY p.id
           ORDER BY qty_sold DESC`
        )
        .all(range.startDate, range.endDate) as {
        product_id: number
        product_name: string
        qty_sold: number
        revenue_cents: number
      }[]

      return rows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        qtySold: r.qty_sold,
        revenueCents: r.revenue_cents
      }))
    }
  )

  ipcMain.handle('analytics:profit', (_event, range: DateRange): ProfitSummary => {
    // Costs current product.cost_price_cents rather than the cost at time of sale (not
    // snapshotted on sale_items) — fine for a lazy report, would drift if costs change often.
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(si.line_total_cents), 0) AS revenue,
                COALESCE(SUM(si.qty * p.cost_price_cents), 0) AS cost
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.status = 'completed' AND date(s.created_at, 'localtime') BETWEEN ? AND ?`
      )
      .get(range.startDate, range.endDate) as { revenue: number; cost: number }

    return { revenueCents: row.revenue, costCents: row.cost, profitCents: row.revenue - row.cost }
  })

  ipcMain.handle('analytics:inventoryValuation', (): InventoryValuationSummary => {
    const rows = db
      .prepare(
        `SELECT COALESCE(c.name, 'Uncategorized') AS category_name,
                SUM(p.stock_qty) AS qty, SUM(p.stock_qty * p.cost_price_cents) AS cost_cents,
                SUM(p.stock_qty * p.sell_price_cents) AS retail_cents
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.active = 1
         GROUP BY category_name
         ORDER BY cost_cents DESC`
      )
      .all() as { category_name: string; qty: number; cost_cents: number; retail_cents: number }[]

    const items: InventoryValuationItem[] = rows.map((r) => ({
      categoryName: r.category_name,
      qty: r.qty,
      costCents: r.cost_cents,
      retailCents: r.retail_cents
    }))

    return {
      items,
      totalCostCents: items.reduce((sum, i) => sum + i.costCents, 0),
      totalRetailCents: items.reduce((sum, i) => sum + i.retailCents, 0)
    }
  })

  ipcMain.handle('analytics:cashFlow', (_event, range: DateRange): CashFlowSummary => {
    const cashIn = db
      .prepare(
        `SELECT COALESCE(SUM(p.amount_cents), 0) AS total
         FROM payments p JOIN sales s ON s.id = p.sale_id
         WHERE p.method = 'cash' AND s.status = 'completed' AND date(s.created_at, 'localtime') BETWEEN ? AND ?`
      )
      .get(range.startDate, range.endDate) as { total: number }

    const expenses = db
      .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE expense_date BETWEEN ? AND ?`)
      .get(range.startDate, range.endDate) as { total: number }

    return { cashInCents: cashIn.total, expensesCents: expenses.total, netCents: cashIn.total - expenses.total }
  })

  ipcMain.handle('analytics:expenses:list', (_event, range: DateRange): Expense[] => {
    const rows = db
      .prepare(
        `SELECT e.id, e.expense_date, e.category, e.amount_cents, e.note, emp.name AS employee_name
         FROM expenses e JOIN employees emp ON emp.id = e.employee_id
         WHERE e.expense_date BETWEEN ? AND ?
         ORDER BY e.expense_date DESC, e.id DESC`
      )
      .all(range.startDate, range.endDate) as {
      id: number
      expense_date: string
      category: string
      amount_cents: number
      note: string | null
      employee_name: string
    }[]

    return rows.map((r) => ({
      id: r.id,
      date: r.expense_date,
      category: r.category,
      amountCents: r.amount_cents,
      note: r.note,
      employeeName: r.employee_name
    }))
  })

  ipcMain.handle('analytics:expenses:create', (_event, input: ExpenseCreateInput): Expense => {
    requireRealEmployee(input.employeeId)
    if (!input.category.trim()) throw new Error('A category is required')
    if (input.amountCents <= 0) throw new Error('Amount must be positive')

    const note = input.note?.trim() || null
    const id = Number(
      db
        .prepare(
          `INSERT INTO expenses (expense_date, category, amount_cents, note, employee_id) VALUES (?, ?, ?, ?, ?)`
        )
        .run(input.date, input.category.trim(), input.amountCents, note, input.employeeId).lastInsertRowid
    )
    insertOutbox(db, 'expenses', id, 'insert', {
      id,
      expense_date: input.date,
      category: input.category.trim(),
      amount_cents: input.amountCents,
      note,
      employee_id: input.employeeId
    })

    const employee = db.prepare('SELECT name FROM employees WHERE id = ?').get(input.employeeId) as {
      name: string
    }
    return { id, date: input.date, category: input.category.trim(), amountCents: input.amountCents, note, employeeName: employee.name }
  })
}
