// SQLite's datetime('now') stores UTC with no timezone suffix; append one so `Date` parses it
// as UTC instead of (incorrectly) treating it as local time.
export function parseDbTimestamp(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

// Local (not UTC) calendar date as YYYY-MM-DD — matches what a user means by "today",
// unlike `toISOString().slice(0, 10)` which is UTC and can be off by a day near midnight.
export function formatLocalDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// `new Date('YYYY-MM-DD')` parses as UTC per spec, which can land on the wrong day in
// negative-offset timezones — the Date(y, m, d) constructor always uses local time.
export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayLocalDate(): string {
  return formatLocalDate(new Date())
}

export function daysAgoLocalDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return formatLocalDate(d)
}

// Adds (or subtracts, for negative delta) whole days to a Date's local calendar date —
// lets callers do date math relative to an injected `now` instead of the real clock (testability).
export function addDays(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta)
}
