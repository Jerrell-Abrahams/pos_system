import { useEffect, useState } from 'react'
import { formatRands } from '@shared/money'
import { daysAgoLocalDate, todayLocalDate } from '@shared/dates'
import type {
  AnalyticsPeriod,
  CashFlowSummary,
  DateRange,
  Expense,
  InventoryValuationSummary,
  ProductPerformanceItem,
  ProfitSummary,
  SalesByPeriodPoint
} from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { useNavStore } from '../../stores/navStore'
import { DatePicker } from '../common/DatePicker'
import { MoneyField } from '../common/MoneyField'

type ReportId =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'bestSelling'
  | 'slowMoving'
  | 'profit'
  | 'expenses'
  | 'inventoryValuation'
  | 'cashFlow'

const REPORTS: { id: ReportId; label: string }[] = [
  { id: 'daily', label: 'Daily sales' },
  { id: 'weekly', label: 'Weekly sales' },
  { id: 'monthly', label: 'Monthly sales' },
  { id: 'yearly', label: 'Yearly sales' },
  { id: 'bestSelling', label: 'Best-selling products' },
  { id: 'slowMoving', label: 'Slow-moving products' },
  { id: 'profit', label: 'Profit report' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'inventoryValuation', label: 'Inventory valuation' },
  { id: 'cashFlow', label: 'Cash flow summary' }
]

const PERIOD_BY_REPORT: Record<string, AnalyticsPeriod> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year'
}

export function AnalyticsScreen(): React.JSX.Element {
  const navParams = useNavStore((s) => s.params)
  const initialReport = REPORTS.some((r) => r.id === navParams?.report) ? (navParams?.report as ReportId) : 'daily'
  const [report, setReport] = useState<ReportId>(initialReport)
  const [range, setRange] = useState<DateRange>({ startDate: daysAgoLocalDate(29), endDate: todayLocalDate() })

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r border-border p-2">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReport(r.id)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
              report === r.id ? 'bg-accent-tint text-accent-light' : 'text-ink-muted active:bg-accent-tint'
            }`}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {(report === 'bestSelling' ||
          report === 'slowMoving' ||
          report === 'profit' ||
          report === 'expenses' ||
          report === 'cashFlow') && <RangePicker range={range} onChange={setRange} />}

        {report in PERIOD_BY_REPORT && <SalesByPeriodReport period={PERIOD_BY_REPORT[report]} />}
        {(report === 'bestSelling' || report === 'slowMoving') && (
          <ProductPerformanceReport range={range} slowMoving={report === 'slowMoving'} />
        )}
        {report === 'profit' && <ProfitReport range={range} />}
        {report === 'expenses' && <ExpensesReport range={range} />}
        {report === 'inventoryValuation' && <InventoryValuationReport />}
        {report === 'cashFlow' && <CashFlowReport range={range} />}
      </div>
    </div>
  )
}

function RangePicker({
  range,
  onChange
}: {
  range: DateRange
  onChange: (range: DateRange) => void
}): React.JSX.Element {
  return (
    <div className="mb-4 flex items-end gap-3">
      <DatePicker
        label="From"
        value={range.startDate}
        max={range.endDate}
        onChange={(startDate) => onChange({ ...range, startDate })}
      />
      <DatePicker
        label="To"
        value={range.endDate}
        min={range.startDate}
        max={todayLocalDate()}
        onChange={(endDate) => onChange({ ...range, endDate })}
      />
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }): React.JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-ink-muted">
          {head.map((h) => (
            <th key={h} className="py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length} className="py-4 text-center text-ink-muted">
              No data for this period
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 text-ink">
              {row.map((cell, j) => (
                <td key={j} className="py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

function SalesByPeriodReport({ period }: { period: AnalyticsPeriod }): React.JSX.Element {
  const [points, setPoints] = useState<SalesByPeriodPoint[] | null>(null)

  useEffect(() => {
    setPoints(null)
    void window.api.analytics.salesByPeriod(period).then(setPoints)
  }, [period])

  if (!points) return <p className="text-sm text-ink-muted">Loading…</p>

  return (
    <Table
      head={['Period', 'Sales', 'Total']}
      rows={points.map((p) => [p.period, p.salesCount, formatRands(p.totalCents)])}
    />
  )
}

function ProductPerformanceReport({
  range,
  slowMoving
}: {
  range: DateRange
  slowMoving: boolean
}): React.JSX.Element {
  const [items, setItems] = useState<ProductPerformanceItem[] | null>(null)

  useEffect(() => {
    setItems(null)
    void window.api.analytics.productPerformance(range).then(setItems)
  }, [range])

  if (!items) return <p className="text-sm text-ink-muted">Loading…</p>

  const sorted = slowMoving ? [...items].reverse() : items
  const top = sorted.slice(0, 15)

  return (
    <Table
      head={['Product', 'Qty sold', 'Revenue']}
      rows={top.map((p) => [p.productName, p.qtySold, formatRands(p.revenueCents)])}
    />
  )
}

function ProfitReport({ range }: { range: DateRange }): React.JSX.Element {
  const [summary, setSummary] = useState<ProfitSummary | null>(null)

  useEffect(() => {
    setSummary(null)
    void window.api.analytics.profit(range).then(setSummary)
  }, [range])

  if (!summary) return <p className="text-sm text-ink-muted">Loading…</p>

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Revenue" value={formatRands(summary.revenueCents)} />
      <Stat label="Cost" value={formatRands(summary.costCents)} />
      <Stat label="Profit" value={formatRands(summary.profitCents)} />
    </div>
  )
}

function InventoryValuationReport(): React.JSX.Element {
  const [summary, setSummary] = useState<InventoryValuationSummary | null>(null)

  useEffect(() => {
    void window.api.analytics.inventoryValuation().then(setSummary)
  }, [])

  if (!summary) return <p className="text-sm text-ink-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total cost value" value={formatRands(summary.totalCostCents)} />
        <Stat label="Total retail value" value={formatRands(summary.totalRetailCents)} />
      </div>
      <Table
        head={['Category', 'Qty', 'Cost value', 'Retail value']}
        rows={summary.items.map((i) => [i.categoryName, i.qty, formatRands(i.costCents), formatRands(i.retailCents)])}
      />
    </div>
  )
}

function CashFlowReport({ range }: { range: DateRange }): React.JSX.Element {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null)

  useEffect(() => {
    setSummary(null)
    void window.api.analytics.cashFlow(range).then(setSummary)
  }, [range])

  if (!summary) return <p className="text-sm text-ink-muted">Loading…</p>

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Cash in" value={formatRands(summary.cashInCents)} />
      <Stat label="Expenses" value={formatRands(summary.expensesCents)} />
      <Stat label="Net" value={formatRands(summary.netCents)} />
    </div>
  )
}

function ExpensesReport({ range }: { range: DateRange }): React.JSX.Element {
  const employee = useAuthStore((s) => s.employee)
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [date, setDate] = useState(todayLocalDate())
  const [category, setCategory] = useState('')
  const [amountCents, setAmountCents] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  function refresh(): void {
    void window.api.analytics.expenses.list(range).then(setExpenses)
  }

  useEffect(() => {
    setExpenses(null)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  async function handleAdd(): Promise<void> {
    if (!employee || !category.trim() || amountCents <= 0) return
    setSaving(true)
    try {
      await window.api.analytics.expenses.create({
        date,
        category: category.trim(),
        amountCents,
        note: note.trim() || undefined,
        employeeId: employee.id
      })
      setCategory('')
      setAmountCents(0)
      setNote('')
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
        <DatePicker label="Date" value={date} max={todayLocalDate()} onChange={setDate} />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 w-32 rounded-lg border border-border bg-surface px-2 text-ink"
        />
        <div className="w-32">
          <MoneyField label="Amount" cents={amountCents} onChange={setAmountCents} />
        </div>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11 w-40 rounded-lg border border-border bg-surface px-2 text-ink"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !category.trim() || amountCents <= 0}
          className="h-11 rounded-lg bg-accent-light px-4 text-sm font-medium text-surface disabled:opacity-40"
        >
          Add expense
        </button>
      </div>

      {!expenses ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <Table
          head={['Date', 'Category', 'Amount', 'Note', 'Recorded by']}
          rows={expenses.map((e) => [e.date, e.category, formatRands(e.amountCents), e.note ?? '', e.employeeName])}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  )
}
