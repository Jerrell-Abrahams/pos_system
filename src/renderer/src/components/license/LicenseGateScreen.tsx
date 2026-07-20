import { useState } from 'react'
import { useLicenseStore } from '../../stores/licenseStore'
import type { LicenseReason } from '@shared/types'

const BLOCKED_MESSAGES: Record<Exclude<LicenseReason, 'not_activated'>, string> = {
  pending: 'This subscription is awaiting activation. Contact your administrator.',
  past_due: 'Payment is past due on this subscription. Contact your administrator to update billing.',
  canceled: 'This subscription has been canceled.',
  expired: 'This subscription has expired.',
  revoked: 'This subscription has been revoked.',
  verification_required: "Couldn't verify your subscription — check your internet connection and retry.",
  clock_rollback: "This device's clock appears to be set incorrectly. Fix the system date and time, then retry."
}

function TextField({
  label,
  type,
  value,
  onChange
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <div>
      <label className="text-xs text-ink-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
      />
    </div>
  )
}

function ActivationForm(): React.JSX.Element {
  const activate = useLicenseStore((s) => s.activate)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!email || !password || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await activate(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="w-80 rounded-2xl border border-border bg-surface p-5">
      <h1 className="text-lg font-semibold text-ink">Activate this device</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in with your subscription account to start using the POS.</p>
      <div className="mt-4 space-y-3">
        <TextField label="Email" type="email" value={email} onChange={setEmail} />
        <TextField label="Password" type="password" value={password} onChange={setPassword} />
      </div>
      <p className="mt-3 min-h-5 text-sm text-danger">{error}</p>
      <button
        type="submit"
        disabled={!email || !password || submitting}
        className="h-14 w-full rounded-xl border border-accent-border bg-accent-tint text-sm font-medium text-accent-light disabled:opacity-50"
      >
        {submitting ? 'Activating…' : 'Activate'}
      </button>
    </form>
  )
}

function BlockedScreen({ reason }: { reason: Exclude<LicenseReason, 'not_activated'> }): React.JSX.Element {
  const recheck = useLicenseStore((s) => s.recheck)
  const status = useLicenseStore((s) => s.status)

  return (
    <div className="w-96 rounded-2xl border border-border bg-surface p-5">
      <h1 className="text-lg font-semibold text-ink">Subscription inactive</h1>
      <p className="mt-2 text-sm text-ink-muted">{BLOCKED_MESSAGES[reason]}</p>
      <button
        type="button"
        onClick={() => void recheck()}
        disabled={status === 'checking'}
        className="mt-5 h-14 w-full rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint disabled:opacity-50"
      >
        {status === 'checking' ? 'Checking…' : 'Retry'}
      </button>
    </div>
  )
}

export function LicenseGateScreen(): React.JSX.Element {
  const status = useLicenseStore((s) => s.status)
  const reason = useLicenseStore((s) => s.reason)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-bg">
      {status === 'checking' && reason === null ? (
        <p className="text-sm text-ink-muted">Checking subscription…</p>
      ) : status === 'unactivated' || reason === 'not_activated' ? (
        <ActivationForm />
      ) : (
        <BlockedScreen reason={(reason ?? 'verification_required') as Exclude<LicenseReason, 'not_activated'>} />
      )}
    </div>
  )
}
