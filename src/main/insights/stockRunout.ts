import type Database from 'better-sqlite3'
import { addDays, formatLocalDate } from '@shared/dates'
import type { Insight } from '@shared/types'

const LOOKBACK_DAYS = 14
const MIN_DAILY_RATE = 0.2
const WARNING_DAYS = 5
const CRITICAL_DAYS = 2

interface Candidate {
  productId: number
  productName: string
  daysRemaining: number
}

export function stockRunoutInsight(db: Database.Database, now: Date): Insight | null {
  const startDate = formatLocalDate(addDays(now, -(LOOKBACK_DAYS - 1)))

  const activeDaysRow = db
    .prepare(
      `SELECT COUNT(DISTINCT date(created_at, 'localtime')) AS n
       FROM sales WHERE status = 'completed' AND date(created_at, 'localtime') >= ?`
    )
    .get(startDate) as { n: number }
  if (activeDaysRow.n === 0) return null

  const soldRows = db
    .prepare(
      `SELECT si.product_id AS productId, SUM(si.qty) AS qty
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND date(s.created_at, 'localtime') >= ?
       GROUP BY si.product_id`
    )
    .all(startDate) as { productId: number; qty: number }[]
  if (soldRows.length === 0) return null

  const placeholders = soldRows.map(() => '?').join(',')
  const products = db
    .prepare(
      `SELECT id, name, stock_qty AS stockQty FROM products
       WHERE active = 1 AND stock_qty > 0 AND id IN (${placeholders})`
    )
    .all(...soldRows.map((r) => r.productId)) as { id: number; name: string; stockQty: number }[]
  const stockById = new Map(products.map((p) => [p.id, p]))

  const candidates: Candidate[] = []
  for (const row of soldRows) {
    const product = stockById.get(row.productId)
    if (!product) continue
    const dailyRate = row.qty / activeDaysRow.n
    if (dailyRate < MIN_DAILY_RATE) continue
    const daysRemaining = product.stockQty / dailyRate
    if (daysRemaining <= WARNING_DAYS) {
      candidates.push({ productId: product.id, productName: product.name, daysRemaining })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.daysRemaining - b.daysRemaining)

  if (candidates.length >= 2) {
    return {
      id: 'stock-runout',
      level: 'warning',
      message: `**${candidates.length} products** are likely to run out within 5 days.`,
      emphasis: `${candidates.length} products`,
      navigateTo: { screen: 'inventory', params: { sortLowStock: true } },
      priority: 2
    }
  }

  const top = candidates[0]
  const days = Math.max(0, Math.round(top.daysRemaining))
  const dayText = `${days} day${days === 1 ? '' : 's'}`
  return {
    id: 'stock-runout',
    level: top.daysRemaining <= CRITICAL_DAYS ? 'critical' : 'warning',
    message: `**${top.productName}** will likely run out in **${dayText}**.`,
    emphasis: dayText,
    navigateTo: { screen: 'inventory', params: { productId: top.productId } },
    priority: 2
  }
}
