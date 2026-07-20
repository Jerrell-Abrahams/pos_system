interface SelectProps {
  value: string | number
  onChange: (value: string) => void
  children: React.ReactNode
  surface?: 'bg' | 'surface'
}

// Native <select> arrows sit flush against the border regardless of padding — appearance-none
// drops the browser's own arrow so this custom chevron can sit with proper spacing instead.
export function Select({ value, onChange, children, surface = 'bg' }: SelectProps): React.JSX.Element {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 w-full appearance-none rounded-xl border border-border ${
          surface === 'surface' ? 'bg-surface' : 'bg-bg'
        } py-0 pl-3 pr-9 text-ink focus:border-accent-border focus:outline-none`}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      >
        <path d="M5 7l5 6 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
