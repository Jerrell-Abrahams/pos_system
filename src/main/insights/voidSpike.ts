import type Database from 'better-sqlite3'
import { addDays, formatLocalDate } from '@shared/dates'
import type { Insight } from '@shared/types'

const AVG_WINDOW_DAYS = 14
const MIN_TODAY_COUNT = 3
const SPIKE_MULTIPLIER = 2

export function voidSpikeInsight(db: Database.Database, now: Date): Insight | null {
  const today = formatLocalDate(now)

  const todayRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sales
       WHERE status IN ('voided', 'refunded') AND date(created_at, 'localtime') = ?`
    )
    .get(today) as { n: number }
  if (todayRow.n < MIN_TODAY_COUNT) return null

  const windowStart = formatLocalDate(addDays(now, -AVG_WINDOW_DAYS))
  const windowEnd = formatLocalDate(addDays(now, -1))
  const historyRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sales
       WHERE status IN ('voided', 'refunded') AND date(created_at, 'localtime') BETWEEN ? AND ?`
    )
    .get(windowStart, windowEnd) as { n: number }
  const avgPerDay = historyRow.n / AVG_WINDOW_DAYS

  if (todayRow.n < avgPerDay * SPIKE_MULTIPLIER) return null

  const avgLabel = avgPerDay < 1 ? 'less than 1' : String(Math.round(avgPerDay))
  const countText = `${todayRow.n} sales`

  return {
    id: 'void-spike',
    level: 'warning',
    message: `**${countText}** were voided or refunded today — above your usual **${avgLabel} per day**.`,
    emphasis: countText,
    navigateTo: { screen: 'salesHistory', params: { voidedOnly: true } },
    priority: 2
  }
}
