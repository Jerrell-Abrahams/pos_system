import { useState } from 'react'
import { formatLocalDate, parseLocalDate, todayLocalDate } from '@shared/dates'

interface DatePickerProps {
  label: string
  value: string
  onChange: (date: string) => void
  min?: string
  max?: string
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatDisplayDate(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DatePicker({ label, value, onChange, min, max }: DatePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseLocalDate(value || todayLocalDate())
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  function openPicker(): void {
    const d = parseLocalDate(value || todayLocalDate())
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setOpen(true)
  }

  function pick(date: string): void {
    onChange(date)
    setOpen(false)
  }

  const firstWeekday = viewMonth.getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => formatLocalDate(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)))
  ]

  return (
    <div className="inline-block">
      <span className="mb-1 block text-xs text-ink-muted">{label}</span>
      <button
        type="button"
        onClick={openPicker}
        className="h-11 min-w-36 rounded-lg border border-border bg-surface px-3 text-left text-sm font-medium text-ink active:bg-accent-tint"
      >
        {formatDisplayDate(value)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-80 rounded-2xl border border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-ink active:bg-accent-tint"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-ink">
                {viewMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-ink active:bg-accent-tint"
              >
                ›
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((w, i) => (
                <span key={i} className="flex h-8 items-center justify-center text-xs text-ink-muted">
                  {w}
                </span>
              ))}
              {cells.map((date, i) => {
                if (!date) return <span key={i} />
                const disabled = Boolean((min && date < min) || (max && date > max))
                const isSelected = date === value
                const isToday = date === todayLocalDate()
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(date)}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-medium disabled:opacity-30 ${
                      isSelected
                        ? 'bg-accent text-bg'
                        : isToday
                          ? 'border border-accent-border text-ink'
                          : 'text-ink active:bg-accent-tint'
                    }`}
                  >
                    {Number(date.slice(-2))}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 h-11 w-full rounded-xl text-sm font-medium text-ink-muted active:bg-accent-tint"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
