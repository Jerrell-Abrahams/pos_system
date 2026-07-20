import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { useLicenseStore } from './stores/licenseStore'
import PinLogin from './components/login/PinLogin'
import { AppShell } from './components/shell/AppShell'
import { LicenseGateScreen } from './components/license/LicenseGateScreen'
import { SetupScreen } from './components/setup/SetupScreen'

function App(): React.JSX.Element {
  const employee = useAuthStore((s) => s.employee)
  const licenseStatus = useLicenseStore((s) => s.status)
  const initLicense = useLicenseStore((s) => s.init)

  // null = not checked yet; a packaged install has no employees until first-run setup creates one.
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    initLicense()
  }, [initLicense])

  useEffect(() => {
    void window.api.setup.status().then((s) => setNeedsSetup(s.needsSetup))
  }, [])

  const handleSetupDone = useCallback(() => setNeedsSetup(false), [])

  if (licenseStatus !== 'ok') return <LicenseGateScreen />
  if (needsSetup === null) return <div className="h-full bg-bg" />
  if (needsSetup) return <SetupScreen onDone={handleSetupDone} />
  return (
    <div key={employee ? 'app' : 'login'} className="h-full animate-screen-in">
      {employee ? <AppShell /> : <PinLogin />}
    </div>
  )
}

export default App
