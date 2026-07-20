import type Database from 'better-sqlite3'
import { formatLocalDate } from '@shared/dates'
import { formatRandsWhole } from '@shared/money'
import type { Insight } from '@shared/types'

const DEFAULT_THRESHOLD_CENTS = 5000

function getThresholdCents(db: Database.Database): number {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = 'insight_cash_variance_threshold_cents'`)
    .get() as { value: string } | undefined
  return row ? Number(row.value) : DEFAULT_THRESHOLD_CENTS
}

export function cashVarianceInsight(db: Database.Database, now: Date): Insight | null {
  const today = formatLocalDate(now)
  const row = db
    .prepare(
      `SELECT cash_difference_cents AS diff
       FROM tills
       WHERE status = 'closed' AND date(closed_at, 'localtime') = ?
       ORDER BY closed_at DESC LIMIT 1`
    )
    .get(today) as { diff: number | null } | undefined
  if (!row || row.diff === null) return null

  const threshold = getThresholdCents(db)
  const diff = row.diff
  const absText = formatRandsWhole(Math.abs(diff))

  if (diff < -threshold) {
    return {
      id: 'cash-variance',
      level: 'critical',
      message: `Cash counted was **${absText} less** than expected at last till close.`,
      emphasis: `${absText} less`,
      priority: 1
    }
  }
  if (diff > threshold) {
    return {
      id: 'cash-variance',
      level: 'warning',
      message: `Cash counted was **${absText} more** than expected at last till close.`,
      emphasis: `${absText} more`,
      priority: 1
    }
  }
  return {
    id: 'cash-variance',
    level: 'good',
    message: `Last till close balanced within **${absText}**.`,
    emphasis: absText,
    priority: 1
  }
}
