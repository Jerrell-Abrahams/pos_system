import type Database from 'better-sqlite3'
import { addDays, formatLocalDate } from '@shared/dates'
import type { Insight } from '@shared/types'

const UP_THRESHOLD_PERCENT = 5
const DOWN_THRESHOLD_PERCENT = 15
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function totalUpToTimeOfDay(db: Database.Database, date: string, timeOfDay: string): { total: number; count: number } {
  return db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS total, COUNT(*) AS count
       FROM sales
       WHERE status = 'completed' AND date(created_at, 'localtime') = ?
         AND time(created_at, 'localtime') <= ?`
    )
    .get(date, timeOfDay) as { total: number; count: number }
}

export function salesTrendInsight(db: Database.Database, now: Date): Insight | null {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const timeOfDay = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const today = formatLocalDate(now)
  const lastWeekDate = addDays(now, -7)
  const lastWeek = formatLocalDate(lastWeekDate)

  const todaySoFar = totalUpToTimeOfDay(db, today, timeOfDay)
  const lastWeekSoFar = totalUpToTimeOfDay(db, lastWeek, timeOfDay)

  if (lastWeekSoFar.count === 0 || lastWeekSoFar.total <= 0) return null

  const changePercent = ((todaySoFar.total - lastWeekSoFar.total) / lastWeekSoFar.total) * 100
  const weekdayName = WEEKDAY_NAMES[lastWeekDate.getDay()]
  const roundedPercent = Math.round(Math.abs(changePercent))
  const percentText = `${roundedPercent}%`

  if (changePercent >= UP_THRESHOLD_PERCENT) {
    return {
      id: 'sales-trend',
      level: 'good',
      message: `Sales are up **${percentText}** compared to last ${weekdayName}.`,
      emphasis: percentText,
      priority: 4
    }
  }
  if (changePercent <= -DOWN_THRESHOLD_PERCENT) {
    return {
      id: 'sales-trend',
      level: 'warning',
      message: `Sales are down **${percentText}** compared to last ${weekdayName}.`,
      emphasis: percentText,
      priority: 4
    }
  }
  return null
}
