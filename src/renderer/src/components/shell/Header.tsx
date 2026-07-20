import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useNavStore, type Screen } from '../../stores/navStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTillStore } from '../../stores/tillStore'
import { CloseTillModal } from '../till/CloseTillModal'

const NAV_ITEMS: { screen: Screen; label: string }[] = [
  { screen: 'pos', label: 'POS' },
  { screen: 'products', label: 'Products' },
  { screen: 'inventory', label: 'Inventory' },
  { screen: 'salesHistory', label: 'Sales History' },
  { screen: 'dashboard', label: 'Dashboard' }
]

const MANAGER_NAV_ITEMS: { screen: Screen; label: string }[] = [
  { screen: 'analytics', label: 'Analytics' },
  { screen: 'promotions', label: 'Promotions' },
  { screen: 'employees', label: 'Employees' },
  { screen: 'history', label: 'History' },
  { screen: 'displayManager', label: 'Display Manager' },
  { screen: 'settings', label: 'Settings' }
]

export function Header(): React.JSX.Element {
  const employee = useAuthStore((s) => s.employee)
  const logout = useAuthStore((s) => s.logout)
  const businessName = useSettingsStore((s) => s.businessName)
  const tillOpen = useTillStore((s) => s.till !== null)
  const screen = useNavStore((s) => s.screen)
  const setScreen = useNavStore((s) => s.setScreen)
  const [closeTillOpen, setCloseTillOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const isManager = employee?.role === 'manager'
  const inMoreSection = MANAGER_NAV_ITEMS.some((item) => item.screen === screen)

  function go(target: Screen): void {
    setScreen(target)
    setMoreOpen(false)
  }

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-ink">{businessName || 'POS'}</span>
        <nav className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.screen}
              type="button"
              onClick={() => go(item.screen)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                screen === item.screen ? 'bg-ink/10 text-ink' : 'text-ink-muted active:bg-accent-tint'
              }`}
            >
              {item.label}
            </button>
          ))}

          {isManager && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                inMoreSection ? 'bg-ink/10 text-ink' : 'text-ink-muted active:bg-accent-tint'
              }`}
            >
              More ▾
            </button>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="h-2.5 w-2.5 rounded-full bg-ink-muted opacity-50" title="Sync not yet available" />
        {tillOpen && (
          <button
            type="button"
            onClick={() => setCloseTillOpen(true)}
            className="h-16 rounded-lg border border-border px-5 text-sm font-medium text-ink-muted active:bg-accent-tint"
          >
            Close Till
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="h-16 rounded-lg border border-border px-5 text-sm font-medium text-ink-muted active:bg-accent-tint"
        >
          Lock
        </button>
      </div>
      {closeTillOpen && <CloseTillModal onClose={() => setCloseTillOpen(false)} />}

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24"
          onClick={() => setMoreOpen(false)}
        >
          <div className="w-64 rounded-2xl border border-border bg-surface p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
            {MANAGER_NAV_ITEMS.map((item) => (
              <button
                key={item.screen}
                type="button"
                onClick={() => go(item.screen)}
                className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${
                  screen === item.screen ? 'bg-accent-tint text-accent-light' : 'text-ink active:bg-accent-tint'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
