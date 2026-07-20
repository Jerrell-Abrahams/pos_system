import { useEffect, useMemo, useState } from 'react'
import { formatRands } from '@shared/money'
import { parseDbTimestamp, todayLocalDate } from '@shared/dates'
import type { SaleListItem } from '@shared/types'
import { useCatalogStore } from '../../stores/catalogStore'
import { useNavStore } from '../../stores/navStore'
import { useProductsStore } from '../../stores/productsStore'
import { DatePicker } from '../common/DatePicker'
import { SearchBar } from '../pos/SearchBar'
import { SaleDetailModal } from './SaleDetailModal'

function formatTime(raw: string): string {
  const d = parseDbTimestamp(raw)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SalesHistoryScreen(): React.JSX.Element {
  const reloadCatalog = useCatalogStore((s) => s.load)
  const reloadProducts = useProductsStore((s) => s.load)
  const navParams = useNavStore((s) => s.params)

  const [date, setDate] = useState(todayLocalDate())
  const [search, setSearch] = useState('')
  const [sales, setSales] = useState<SaleListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Captured once on mount — the void/refund spike card deep-links here pre-filtered.
  const [voidedOnly] = useState(navParams?.voidedOnly ?? false)

  const visibleSales = useMemo(
    () => (voidedOnly ? sales.filter((s) => s.status !== 'completed') : sales),
    [sales, voidedOnly]
  )

  async function refresh(): Promise<void> {
    setLoading(true)
    try {
      const rows = await window.api.sales.list(date, search)
      setSales(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, search])

  function handleVoided(): void {
    void refresh()
    void reloadCatalog()
    void reloadProducts()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-end gap-3">
        <DatePicker label="Date" value={date} max={todayLocalDate()} onChange={setDate} />
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by receipt number or cashier…"
            height="h-11"
          />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!loading && visibleSales.length === 0 && (
          <p className="pt-8 text-center text-sm text-ink-muted">No sales on this date</p>
        )}
        <div className="space-y-2">
          {visibleSales.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => setSelectedId(sale.id)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {sale.receiptNo} <span className="text-ink-muted">· {formatTime(sale.createdAt)}</span>
                </p>
                <p className="text-xs text-ink-muted">{sale.cashierName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-accent-light">{formatRands(sale.totalCents)}</p>
                {sale.status !== 'completed' && (
                  <p className="text-xs uppercase text-danger">{sale.status}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedId !== null && (
        <SaleDetailModal saleId={selectedId} onVoided={handleVoided} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
