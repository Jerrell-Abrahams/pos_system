import { useEffect, useState } from 'react'
import { formatRands } from '@shared/money'
import type { DashboardSummary } from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { useNavStore } from '../../stores/navStore'
import { BusinessHealthSection } from './BusinessHealthSection'
import { EmployeePerformanceChart } from './EmployeePerformanceChart'
import { SalesTrendChart } from './SalesTrendChart'

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', eft: 'EFT' }

export function DashboardScreen(): React.JSX.Element {
  const setScreen = useNavStore((s) => s.setScreen)
  const isManager = useAuthStore((s) => s.employee?.role === 'manager')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh(): Promise<void> {
    setLoading(true)
    try {
      setSummary(await window.api.dashboard.summary())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (!summary) {
    return <div className="p-4 text-sm text-ink-muted">Loading…</div>
  }

  const avgCents = summary.salesCount > 0 ? Math.round(summary.totalCents / summary.salesCount) : 0

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Today — {summary.date}</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-ink-muted active:bg-accent-tint disabled:opacity-40"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
        <BusinessHealthSection />

        <Card label="Sales Trend — Last 14 Days">
          <SalesTrendChart />
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card label="Today's Sales">
            <p className="text-3xl font-semibold text-ink">{summary.salesCount}</p>
            <p className="mt-1 text-sm text-ink-muted">{formatRands(summary.totalCents)} total</p>
          </Card>

          <Card label="VAT Collected">
            <p className="text-3xl font-semibold text-ink">{formatRands(summary.vatCents)}</p>
          </Card>

          <Card label="Average Sale">
            <p className="text-3xl font-semibold text-ink">{formatRands(avgCents)}</p>
          </Card>

          <Card label="Payment Breakdown">
            {summary.paymentBreakdown.length === 0 ? (
              <p className="text-sm text-ink-muted">No sales yet</p>
            ) : (
              <div className="space-y-1">
                {summary.paymentBreakdown.map((p) => (
                  <div key={p.method} className="flex justify-between text-sm text-ink">
                    <span className="text-ink-muted">{METHOD_LABEL[p.method] ?? p.method}</span>
                    <span>{formatRands(p.amountCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <button type="button" onClick={() => setScreen('inventory')} className="text-left">
            <Card label="Low Stock" tone={summary.lowStockCount > 0 ? 'danger' : undefined}>
              <p className={`text-3xl font-semibold ${summary.lowStockCount > 0 ? 'text-danger' : 'text-ink'}`}>
                {summary.lowStockCount}
              </p>
              <p className="mt-1 text-sm text-ink-muted">tap to view Inventory</p>
            </Card>
          </button>

          <Card label="Till Status">
            {summary.till ? (
              <>
                <p className="text-lg font-semibold text-success">Open</p>
                <p className="mt-1 text-sm text-ink-muted">Float {formatRands(summary.till.openingCashCents)}</p>
                <p className="text-sm text-ink-muted">Expected {formatRands(summary.till.expectedCashCents)}</p>
              </>
            ) : (
              <p className="text-lg font-semibold text-ink-muted">No till open</p>
            )}
          </Card>

          {summary.voidedCount > 0 && (
            <Card label="Voided Sales">
              <p className="text-3xl font-semibold text-danger">{summary.voidedCount}</p>
            </Card>
          )}
        </div>

        {isManager && (
          <Card label="Employee Performance — Last 14 Days">
            <EmployeePerformanceChart />
          </Card>
        )}
      </div>
    </div>
  )
}

function Card({
  label,
  tone,
  children
}: {
  label: string
  tone?: 'danger'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={`rounded-xl border p-4 ${tone === 'danger' ? 'border-danger' : 'border-border'} bg-surface`}>
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}
