import { useEffect } from 'react'

// Kiosk escape hatch: an ordinary tap/swipe never has 5 simultaneous contact points, so this
// can't fire by accident and needs no visible button a customer could stumble onto.
export function useFullscreenExitGesture(onTrigger: () => void): void {
  useEffect(() => {
    function handleTouchStart(e: TouchEvent): void {
      if (e.touches.length >= 5) onTrigger()
    }
    window.addEventListener('touchstart', handleTouchStart)
    return () => window.removeEventListener('touchstart', handleTouchStart)
  }, [onTrigger])
}
