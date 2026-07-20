interface KeypadProps {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onSubmit?: () => void
  submitLabel?: string
  submitDisabled?: boolean
  disabled?: boolean
  size?: 'md' | 'lg'
}

export function Keypad({
  onDigit,
  onBackspace,
  onSubmit,
  submitLabel = 'Enter',
  submitDisabled,
  disabled,
  size = 'md'
}: KeypadProps): React.JSX.Element {
  const keyHeight = size === 'lg' ? 'h-24' : 'h-20'
  const digitClass = `${keyHeight} rounded-xl border border-border bg-surface font-medium text-ink active:bg-accent-tint disabled:opacity-40 ${size === 'lg' ? 'text-4xl' : 'text-3xl'}`
  const backClass = `${keyHeight} rounded-xl border border-border bg-surface font-medium text-ink-muted active:bg-accent-tint disabled:opacity-40 ${size === 'lg' ? 'text-2xl' : 'text-xl'}`
  const enterClass = `${keyHeight} rounded-xl bg-accent px-1 font-semibold leading-tight text-bg active:bg-accent-light disabled:opacity-40 ${size === 'lg' ? 'text-base' : 'text-sm'}`

  return (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button key={digit} type="button" className={digitClass} onClick={() => onDigit(digit)} disabled={disabled}>
          {digit}
        </button>
      ))}
      <button type="button" className={backClass} onClick={onBackspace} disabled={disabled}>
        ⌫
      </button>
      <button type="button" className={digitClass} onClick={() => onDigit('0')} disabled={disabled}>
        0
      </button>
      {onSubmit ? (
        <button type="button" className={enterClass} onClick={onSubmit} disabled={submitDisabled || disabled}>
          {submitLabel}
        </button>
      ) : (
        <div />
      )}
    </div>
  )
}
