import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { daysAgoLocalDate, todayLocalDate } from '@shared/dates'
import type { DailySalesPoint, DashboardSummary, EmployeePerformancePoint, PaymentMethod } from '@shared/types'
import { getOpenTill } from '../db/till'

const TREND_DAYS = 14

export function registerDashboardHandlers(db: Database.Database): void {
  ipcMain.handle('dashboard:summary', (): DashboardSummary => {
    const totals = db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total_cents), 0) AS total, COALESCE(SUM(vat_cents), 0) AS vat
         FROM sales WHERE date(created_at, 'localtime') = date('now', 'localtime') AND status = 'completed'`
      )
      .get() as { count: number; total: number; vat: number }

    const voided = db
      .prepare(
        `SELECT COUNT(*) AS n FROM sales
         WHERE date(created_at, 'localtime') = date('now', 'localtime') AND status = 'voided'`
      )
      .get() as { n: number }

    const paymentBreakdown = db
      .prepare(
        `SELECT p.method, COALESCE(SUM(p.amount_cents), 0) AS amount
         FROM payments p JOIN sales s ON s.id = p.sale_id
         WHERE date(s.created_at, 'localtime') = date('now', 'localtime') AND s.status = 'completed'
         GROUP BY p.method`
      )
      .all() as { method: PaymentMethod; amount: number }[]

    const lowStock = db
      .prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock_qty <= low_stock_threshold')
      .get() as { n: number }

    return {
      date: todayLocalDate(),
      salesCount: totals.count,
      totalCents: totals.total,
      vatCents: totals.vat,
      paymentBreakdown: paymentBreakdown.map((p) => ({ method: p.method, amountCents: p.amount })),
      voidedCount: voided.n,
      lowStockCount: lowStock.n,
      till: getOpenTill(db)
    }
  })

  ipcMain.handle('dashboard:salesTrend', (): DailySalesPoint[] => {
    const startDate = daysAgoLocalDate(TREND_DAYS - 1)
    const rows = db
      .prepare(
        `SELECT date(created_at, 'localtime') AS day, COALESCE(SUM(total_cents), 0) AS total
         FROM sales WHERE status = 'completed' AND date(created_at, 'localtime') >= ?
         GROUP BY day`
      )
      .all(startDate) as { day: string; total: number }[]
    const byDay = new Map(rows.map((r) => [r.day, r.total]))

    return Array.from({ length: TREND_DAYS }, (_, i) => {
      const date = daysAgoLocalDate(TREND_DAYS - 1 - i)
      return { date, totalCents: byDay.get(date) ?? 0 }
    })
  })

  ipcMain.handle('dashboard:employeePerformance', (): EmployeePerformancePoint[] => {
    const startDate = daysAgoLocalDate(TREND_DAYS - 1)
    // LEFT JOIN so an active employee with zero sales in the window still shows up at 0,
    // rather than silently disappearing from the ranking.
    const rows = db
      .prepare(
        `SELECT e.id AS employee_id, e.name AS employee_name,
                COUNT(s.id) AS sales_count, COALESCE(SUM(s.total_cents), 0) AS total
         FROM employees e
         LEFT JOIN sales s ON s.employee_id = e.id AND s.status = 'completed'
           AND date(s.created_at, 'localtime') >= ?
         WHERE e.active = 1
         GROUP BY e.id
         ORDER BY total DESC`
      )
      .all(startDate) as { employee_id: number; employee_name: string; sales_count: number; total: number }[]

    return rows.map((r) => ({
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      salesCount: r.sales_count,
      totalCents: r.total
    }))
  })
}
