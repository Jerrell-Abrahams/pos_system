import { useEffect, useState } from 'react'
import { LICENSE_EXPIRY_GRACE_DAYS, LICENSE_EXPIRY_WARNING_DAYS } from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { useLicenseStore } from '../../stores/licenseStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Keypad } from '../common/Keypad'

const LOCKOUT_THRESHOLD = 3
const LOCKOUT_MS = 5000
const SHAKE_MS = 400
const DAY_MS = 24 * 60 * 60 * 1000

function expiryWarning(periodEnd: string | null): { text: string; urgent: boolean } | null {
  if (!periodEnd) return null
  const daysLeft = Math.ceil((new Date(periodEnd).getTime() - Date.now()) / DAY_MS)
  if (daysLeft > LICENSE_EXPIRY_WARNING_DAYS) return null
  if (daysLeft > 0) return { text: `License expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, urgent: false }
  const graceDaysLeft = Math.max(daysLeft + LICENSE_EXPIRY_GRACE_DAYS, 0)
  return {
    text: `License expired — access ends in ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'}`,
    urgent: true
  }
}

function PinLogin(): React.JSX.Element {
  const businessName = useSettingsStore((s) => s.businessName)
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const loadSettings = useSettingsStore((s) => s.load)
  const periodEnd = useLicenseStore((s) => s.periodEnd)
  const warning = expiryWarning(periodEnd)

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(false)
  const [, setFailedAttempts] = useState(0)
  const [lockedUntilMs, setLockedUntilMs] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  useEffect(() => {
    if (!settingsLoaded) void loadSettings()
  }, [settingsLoaded, loadSettings])

  // Ticks the lockout countdown and, once it expires, clears the strike count too — a wrong
  // PIN right after unlocking should get a fresh 3 tries, not instantly re-trigger the cooldown.
  useEffect(() => {
    if (lockedUntilMs === null) return
    const tick = (): void => {
      const remaining = Math.ceil((lockedUntilMs - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntilMs(null)
        setFailedAttempts(0)
        setRemainingSeconds(0)
      } else {
        setRemainingSeconds(remaining)
      }
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [lockedUntilMs])

  const locked = lockedUntilMs !== null

  async function submit(value: string): Promise<void> {
    if (value.length < 4 || submitting || locked) return
    setSubmitting(true)
    const result = await window.api.auth.login(value)
    setSubmitting(false)

    if (result.ok && result.employee) {
      setPin('')
      setError('')
      setFailedAttempts(0)
      useAuthStore.setState({ employee: result.employee })
      return
    }

    setError(result.error ?? 'Incorrect PIN')
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), SHAKE_MS)
    setFailedAttempts((n) => {
      const next = n + 1
      if (next >= LOCKOUT_THRESHOLD) setLockedUntilMs(Date.now() + LOCKOUT_MS)
      return next
    })
  }

  function handleDigit(digit: string): void {
    if (pin.length >= 6 || submitting || locked) return
    const next = pin + digit
    setError('')
    setPin(next)
    if (next.length === 6) void submit(next)
  }

  function handleBackspace(): void {
    setError('')
    setPin((p) => p.slice(0, -1))
  }

  return (
    <div className="flex h-full bg-bg">
      <div
        className="flex w-[42%] flex-col justify-between border-r border-border p-11"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 15%, var(--login-glow), transparent 55%), linear-gradient(160deg, var(--color-surface), var(--login-shade))'
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent-border bg-accent-tint text-xl font-semibold text-accent-light">
          {(businessName || 'POS').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight text-ink">{businessName || 'POS'}</h1>
          <div className="my-5 h-0.5 w-11 bg-accent-border" />
          <p className="max-w-[220px] text-sm leading-relaxed text-ink-muted">
            Welcome back. Tap in your PIN to open your shift.
          </p>
        </div>
        <div className="text-xs uppercase tracking-widest text-ink-muted">
          Point of Sale · v{__APP_VERSION__}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-bg p-10">
        {warning && (
          <p
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              warning.urgent
                ? 'border-danger/40 bg-danger/10 text-danger'
                : 'border-accent-border bg-accent-tint text-accent-light'
            }`}
          >
            {warning.text}
          </p>
        )}
        <div className={`text-center ${shake ? 'animate-shake' : ''}`}>
          <h2 className="text-2xl text-ink">Enter PIN</h2>
          <div className="mt-5 flex justify-center gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`h-5 w-5 rounded-full border ${error ? 'border-danger' : 'border-accent-border'} ${
                  i < pin.length ? (error ? 'bg-danger' : 'bg-accent') : 'bg-transparent'
                }`}
              />
            ))}
          </div>
          <p className="mt-4 min-h-6 text-sm text-danger">
            {locked ? `Too many attempts — try again in ${remainingSeconds}s` : error}
          </p>
        </div>
        <div className="w-80">
          <Keypad
            size="lg"
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={() => void submit(pin)}
            submitDisabled={pin.length < 4 || submitting || locked}
            disabled={locked}
          />
        </div>
      </div>
    </div>
  )
}

export default PinLogin
