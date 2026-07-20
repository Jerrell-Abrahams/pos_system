import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { useLicenseStore } from './stores/licenseStore'
import { ManagerPinModal } from './components/common/ManagerPinModal'
import { useFullscreenExitGesture } from './components/shell/useFullscreenExitGesture'
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
  const [showFullscreenGate, setShowFullscreenGate] = useState(false)

  // Last-resort escape hatch, active on every screen (even license/setup, before any login) —
  // a 5-finger touch is the trigger, but toggling fullscreen still needs a manager PIN so a
  // cashier can't casually expose the desktop to customers.
  useFullscreenExitGesture(() => setShowFullscreenGate(true))

  useEffect(() => {
    initLicense()
  }, [initLicense])

  useEffect(() => {
    void window.api.setup.status().then((s) => setNeedsSetup(s.needsSetup))
  }, [])

  const handleSetupDone = useCallback(() => setNeedsSetup(false), [])

  const content =
    licenseStatus !== 'ok' ? (
      <LicenseGateScreen />
    ) : needsSetup === null ? (
      <div className="h-full bg-bg" />
    ) : needsSetup ? (
      <SetupScreen onDone={handleSetupDone} />
    ) : (
      <div key={employee ? 'app' : 'login'} className="h-full animate-screen-in">
        {employee ? <AppShell /> : <PinLogin />}
      </div>
    )

  return (
    <>
      {content}
      {showFullscreenGate && (
        <ManagerPinModal
          title="Toggle fullscreen?"
          message="Enter a manager PIN to exit or resume fullscreen."
          onAuthorized={() => {
            setShowFullscreenGate(false)
            void window.api.window.toggleFullscreen()
          }}
          onCancel={() => setShowFullscreenGate(false)}
        />
      )}
    </>
  )
}

export default App
