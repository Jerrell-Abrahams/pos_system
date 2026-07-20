import { useEffect } from 'react'

const SCAN_KEY_GAP_MS = 30
const MIN_BARCODE_LENGTH = 4

function isEditable(el: Element | null): boolean {
  return el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export function useBarcodeScanner(onScan: (code: string) => void): void {
  useEffect(() => {
    let buffer = ''
    let lastTime = 0

    function onKeydown(e: KeyboardEvent): void {
      // When a text field is focused (e.g. the search box, whose placeholder invites scanning),
      // let that field own the keys. Otherwise the scanned characters would BOTH add to the cart
      // here AND type into the input, leaving stray digits behind. With no field focused — the
      // normal POS state — keys land on nothing, so this global handler is the only consumer.
      if (isEditable(document.activeElement)) {
        buffer = ''
        return
      }

      const now = Date.now()
      if (now - lastTime > SCAN_KEY_GAP_MS) buffer = ''
      lastTime = now

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_BARCODE_LENGTH) {
          e.preventDefault() // don't let the terminating Enter also activate a focused button
          onScan(buffer)
        }
        buffer = ''
        return
      }
      if (e.key.length === 1) buffer += e.key
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [onScan])
}
