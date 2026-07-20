import type Database from 'better-sqlite3'
import { formatLocalDate } from '@shared/dates'
import type { Insight } from '@shared/types'

const MIN_ITEMS = 20
const TOP_N = 5

export function revenueConcentrationInsight(db: Database.Database, now: Date): Insight | null {
  const today = formatLocalDate(now)

  const itemCountRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND date(s.created_at, 'localtime') = ?`
    )
    .get(today) as { n: number }
  if (itemCountRow.n < MIN_ITEMS) return null

  const rows = db
    .prepare(
      `SELECT si.product_id AS productId, SUM(si.line_total_cents) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND date(s.created_at, 'localtime') = ?
       GROUP BY si.product_id ORDER BY revenue DESC`
    )
    .all(today) as { productId: number; revenue: number }[]
  if (rows.length === 0) return null

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0)
  if (totalRevenue <= 0) return null
  const topRevenue = rows.slice(0, TOP_N).reduce((sum, r) => sum + r.revenue, 0)
  const percentText = `${Math.round((topRevenue / totalRevenue) * 100)}%`

  return {
    id: 'revenue-concentration',
    level: 'info',
    message: `Your top five products generated **${percentText}** of today's revenue.`,
    emphasis: percentText,
    navigateTo: { screen: 'analytics', params: { report: 'bestSelling' } },
    priority: 5
  }
}
