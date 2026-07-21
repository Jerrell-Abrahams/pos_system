import { useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useNavStore } from '../../stores/navStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTillStore } from '../../stores/tillStore'
import { useToastStore } from '../../stores/toastStore'
import { useInactivityTimer } from './useInactivityTimer'
import { EmployeePill } from './EmployeePill'
import { Header } from './Header'
import { AnalyticsScreen } from '../analytics/AnalyticsScreen'
import { DashboardScreen } from '../dashboard/DashboardScreen'
import { DisplayManagerScreen } from '../displayManager/DisplayManagerScreen'
import { EmployeesScreen } from '../employees/EmployeesScreen'
import { HistoryScreen } from '../history/HistoryScreen'
import { InventoryScreen } from '../inventory/InventoryScreen'
import { PromotionsScreen } from '../promotions/PromotionsScreen'
import { SalesHistoryScreen } from '../salesHistory/SalesHistoryScreen'
import { SettingsScreen } from '../settings/SettingsScreen'
import { OpenTillPanel } from '../till/OpenTillPanel'
import { ProductsScreen } from '../products/ProductsScreen'
import PosScreen from '../pos/PosScreen'

export function AppShell(): React.JSX.Element {
  const logout = useAuthStore((s) => s.logout)
  const autoLockSeconds = useSettingsStore((s) => s.autoLockSeconds)
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const loadSettings = useSettingsStore((s) => s.load)
  const pushToast = useToastStore((s) => s.push)
  const tillChecked = useTillStore((s) => s.checked)
  const till = useTillStore((s) => s.till)
  const refreshTill = useTillStore((s) => s.refresh)
  const screen = useNavStore((s) => s.screen)
  const employee = useAuthStore((s) => s.employee)

  useEffect(() => {
    if (!settingsLoaded) void loadSettings()
  }, [settingsLoaded, loadSettings])

  useEffect(() => {
    if (!tillChecked) void refreshTill()
  }, [tillChecked, refreshTill])

  useEffect(() => {
    return window.api.printer.onIssue((event) => pushToast(event.message, 'error'))
  }, [pushToast])

  useInactivityTimer(autoLockSeconds, logout)

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="min-h-0 flex-1">
        <div key={screen} className="h-full animate-screen-in">
          {screen === 'products' ? (
            <ProductsScreen />
          ) : screen === 'inventory' ? (
            <InventoryScreen />
          ) : screen === 'salesHistory' ? (
            <SalesHistoryScreen />
          ) : screen === 'dashboard' ? (
            <DashboardScreen />
          ) : screen === 'settings' && employee?.role === 'manager' ? (
            <SettingsScreen />
          ) : screen === 'analytics' && employee?.role === 'manager' ? (
            <AnalyticsScreen />
          ) : screen === 'promotions' && employee?.role === 'manager' ? (
            <PromotionsScreen />
          ) : screen === 'employees' && employee?.role === 'manager' ? (
            <EmployeesScreen />
          ) : screen === 'history' && employee?.role === 'manager' ? (
            <HistoryScreen />
          ) : screen === 'displayManager' && employee?.role === 'manager' ? (
            <DisplayManagerScreen />
          ) : !tillChecked ? null : till ? (
            <PosScreen />
          ) : (
            <OpenTillPanel />
          )}
        </div>
      </main>
      <EmployeePill />
    </div>
  )
}
