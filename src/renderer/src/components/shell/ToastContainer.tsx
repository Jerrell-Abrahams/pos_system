import { useToastStore } from '../../stores/toastStore'

export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm ${
            t.tone === 'error' ? 'border-danger bg-surface text-danger' : 'border-border bg-surface text-ink'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-ink-muted"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
