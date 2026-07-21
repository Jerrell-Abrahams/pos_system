interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string
  autoFocus?: boolean
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search by name or scan barcode…',
  height = 'h-16',
  autoFocus = false
}: SearchBarProps): React.JSX.Element {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`${height} w-full rounded-xl border border-border bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none`}
    />
  )
}
