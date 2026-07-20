import { useEffect, useState } from 'react'
import { formatRands } from '@shared/money'
import { daysAgoLocalDate, formatLocalDate, parseDbTimestamp, todayLocalDate } from '@shared/dates'
import type { AuditLogEntry, EmployeeListItem } from '@shared/types'
import { DatePicker } from '../common/DatePicker'
import { Select } from '../common/Select'
import { SearchBar } from '../pos/SearchBar'

const ACTIONS = [
  'sale.create',
  'sale.void',
  'stock.adjust',
  'product.create',
  'product.update',
  'employee.create',
  'employee.update',
  'settings.update',
  'combo.create',
  'combo.update',
  'till.open',
  'till.close'
]

function formatDate(raw: string): string {
  return formatLocalDate(parseDbTimestamp(raw))
}

function formatTime(raw: string): string {
  const d = parseDbTimestamp(raw)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

function formatValue(key: string, value: unknown): string {
  if (typeof value === 'number' && key.endsWith('Cents')) return formatRands(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

interface FieldChange {
  before: unknown
  after: unknown
}

// Renders both shapes a details blob can take: a plain snapshot (creates: {name, priceCents})
// and a diff (updates: {changes: {field: {before, after}}, ...extras}).
function formatDetails(raw: string | null): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const parts: string[] = []
    const changes = parsed.changes as Record<string, FieldChange> | undefined
    if (changes) {
      for (const [field, change] of Object.entries(changes)) {
        parts.push(`${humanizeKey(field)}: ${formatValue(field, change.before)} → ${formatValue(field, change.after)}`)
      }
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (key === 'changes') continue
      parts.push(`${humanizeKey(key)}: ${formatValue(key, value)}`)
    }
    return parts.join(' · ')
  } catch {
    return raw
  }
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: string[][]): void {
  const content = rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryScreen(): React.JSX.Element {
  const [startDate, setStartDate] = useState(daysAgoLocalDate(6))
  const [endDate, setEndDate] = useState(todayLocalDate())
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void window.api.employees.list().then(setEmployees)
  }, [])

  async function refresh(): Promise<void> {
    setLoading(true)
    try {
      setEntries(await window.api.auditLog.list({ startDate, endDate, employeeId, action, search }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, employeeId, action, search])

  function handleExport(): void {
    const header = ['Date', 'Time', 'Employee', 'Action', 'Entity', 'Details']
    const rows = entries.map((entry) => [
      formatDate(entry.createdAt),
      formatTime(entry.createdAt),
      entry.employeeName ?? 'System',
      entry.action,
      `${entry.entityType}${entry.entityId != null ? ` #${entry.entityId}` : ''}`,
      formatDetails(entry.details)
    ])
    downloadCsv(`history-${startDate}-to-${endDate}.csv`, [header, ...rows])
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex flex-wrap items-end gap-3">
        <DatePicker label="From" value={startDate} max={endDate} onChange={setStartDate} />
        <DatePicker label="To" value={endDate} min={startDate} max={todayLocalDate()} onChange={setEndDate} />

        <div className="w-44">
          <span className="mb-1 block text-xs text-ink-muted">Employee</span>
          <Select value={employeeId ?? ''} onChange={(v) => setEmployeeId(v ? Number(v) : null)}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-44">
          <span className="mb-1 block text-xs text-ink-muted">Action</span>
          <Select value={action ?? ''} onChange={(v) => setAction(v || null)}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-48 flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by entity or employee…" height="h-12" />
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={entries.length === 0}
          className="h-12 shrink-0 rounded-xl border border-border px-4 text-sm font-medium text-ink-muted active:bg-accent-tint disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!loading && entries.length === 0 && (
          <p className="pt-8 text-center text-sm text-ink-muted">No activity in this range</p>
        )}
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">
                  {entry.action}{' '}
                  <span className="text-ink-muted">
                    · {entry.entityType}
                    {entry.entityId != null ? ` #${entry.entityId}` : ''}
                  </span>
                </p>
                <p className="shrink-0 text-xs text-ink-muted">
                  {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{entry.employeeName ?? 'System'}</p>
              {entry.details && <p className="mt-1 text-xs text-ink-muted">{formatDetails(entry.details)}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
