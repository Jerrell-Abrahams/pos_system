interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-80 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-14 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-14 flex-1 rounded-xl border border-danger text-sm font-medium text-danger active:bg-danger/10"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
