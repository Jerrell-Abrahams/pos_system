import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crash:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="w-96 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
          <p className="mt-2 text-sm text-ink-muted">
            The screen hit an unexpected error. Your till and sales data are unaffected — reload to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-14 w-full rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
