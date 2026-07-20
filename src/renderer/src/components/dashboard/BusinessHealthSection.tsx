import { useEffect, useState } from 'react'
import type { Insight, InsightLevel } from '@shared/types'
import { useNavStore, type Screen } from '../../stores/navStore'

const REFRESH_MS = 60_000

const DOT_CLASS: Record<InsightLevel, string> = {
  critical: 'bg-danger',
  warning: 'bg-accent',
  good: 'bg-success',
  info: 'bg-ink-muted'
}

function renderMessage(message: string): React.ReactNode {
  return message.split(/(\*\*.+?\*\*)/g).map((part, i) => {
    const match = part.match(/^\*\*(.+)\*\*$/)
    return match ? (
      <strong key={i} className="text-accent-light">
        {match[1]}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  })
}

export function BusinessHealthSection(): React.JSX.Element | null {
  const [insights, setInsights] = useState<Insight[]>([])
  const navigate = useNavStore((s) => s.navigate)

  useEffect(() => {
    let cancelled = false
    async function refresh(): Promise<void> {
      const result = await window.api.insights.get()
      if (!cancelled) setInsights(result)
    }
    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (insights.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-ink-muted">Business Health</h3>
      {insights.map((insight) => {
        const card = (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[insight.level]}`} />
            <p className="text-sm text-ink">{renderMessage(insight.message)}</p>
          </div>
        )
        if (!insight.navigateTo) return <div key={insight.id}>{card}</div>
        const { screen, params } = insight.navigateTo
        return (
          <button
            key={insight.id}
            type="button"
            onClick={() => navigate(screen as Screen, params)}
            className="block w-full text-left"
          >
            {card}
          </button>
        )
      })}
    </div>
  )
}
