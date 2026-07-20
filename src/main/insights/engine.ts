import type Database from 'better-sqlite3'
import type { Insight } from '@shared/types'
import { cashVarianceInsight } from './cashVariance'
import { peakHourInsight } from './peakHour'
import { revenueConcentrationInsight } from './revenueConcentration'
import { salesTrendInsight } from './salesTrend'
import { stockRunoutInsight } from './stockRunout'
import { voidSpikeInsight } from './voidSpike'

const MAX_INSIGHTS = 6

type InsightFn = (db: Database.Database, now: Date) => Insight | null

const INSIGHT_FNS: InsightFn[] = [
  cashVarianceInsight,
  stockRunoutInsight,
  voidSpikeInsight,
  salesTrendInsight,
  revenueConcentrationInsight,
  peakHourInsight
]

const LEVEL_RANK: Record<Insight['level'], number> = { critical: 0, warning: 1, info: 2, good: 3 }

export function runInsights(db: Database.Database, now: Date): Insight[] {
  const insights = INSIGHT_FNS.map((fn) => fn(db, now)).filter((insight): insight is Insight => insight !== null)
  insights.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.priority - b.priority)
  return insights.slice(0, MAX_INSIGHTS)
}
