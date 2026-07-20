import { useEffect } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'mousemove'] as const

export function useInactivityTimer(timeoutSeconds: number, onTimeout: () => void): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function reset(): void {
      clearTimeout(timer)
      timer = setTimeout(onTimeout, timeoutSeconds * 1000)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset))
    reset()

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset))
    }
  }, [timeoutSeconds, onTimeout])
}
