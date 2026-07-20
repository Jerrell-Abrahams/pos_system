import type Database from 'better-sqlite3'
import { formatLocalDate } from '@shared/dates'
import { formatRandsWhole } from '@shared/money'
import type { Insight } from '@shared/types'

const MIN_COMPLETED_HOURS = 3

export function peakHourInsight(db: Database.Database, now: Date): Insight | null {
  const currentHour = now.getHours()
  if (currentHour < MIN_COMPLETED_HOURS) return null
  const lastCompletedHour = currentHour - 1

  const today = formatLocalDate(now)
  const rows = db
    .prepare(
      `SELECT CAST(strftime('%H', created_at, 'localtime') AS INTEGER) AS hour, SUM(total_cents) AS total
       FROM sales WHERE status = 'completed' AND date(created_at, 'localtime') = ?
       GROUP BY hour`
    )
    .all(today) as { hour: number; total: number }[]
  if (rows.length === 0) return null

  const totalsByHour = new Map(rows.map((r) => [r.hour, r.total]))
  const lastHourTotal = totalsByHour.get(lastCompletedHour) ?? 0
  if (lastHourTotal <= 0) return null

  let best = 0
  for (let h = 0; h <= lastCompletedHour; h++) {
    best = Math.max(best, totalsByHour.get(h) ?? 0)
  }
  if (lastHourTotal < best) return null

  const pad = (n: number): string => String(n).padStart(2, '0')
  const rangeLabel = `${pad(lastCompletedHour)}:00–${pad(lastCompletedHour + 1)}:00`
  const amountText = formatRandsWhole(lastHourTotal)

  return {
    id: 'peak-hour',
    level: 'info',
    message: `This was your busiest hour today: **${amountText}** between ${rangeLabel}.`,
    emphasis: amountText,
    priority: 6
  }
}
