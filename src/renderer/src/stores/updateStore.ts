import { create } from 'zustand'
import type { UpdateStatusEvent } from '@shared/types'
import { useToastStore, type Toast } from './toastStore'

const TOAST_KEY = 'update-status'

// checking/available/downloading chase each other within seconds, so they stay up (sticky)
// until replaced by the next event rather than flashing past the 6s auto-dismiss window.
function toastFor(event: UpdateStatusEvent): { message: string; tone: Toast['tone']; sticky?: boolean } {
  switch (event.kind) {
    case 'checking':
      return { message: 'Checking for updates…', tone: 'info', sticky: true }
    case 'available':
      return { message: `Update v${event.version} found — downloading…`, tone: 'info', sticky: true }
    case 'downloading':
      return { message: `Downloading update… ${event.percent}%`, tone: 'info', sticky: true }
    case 'downloaded':
      // Sticky and left for a manual dismiss -- a restart-pending update shouldn't quietly
      // vanish after 6s if nobody happened to be looking at the screen.
      return { message: `Update v${event.version} ready — installs on next restart`, tone: 'success', sticky: true }
    case 'not-available':
      return { message: "You're on the latest version", tone: 'info' }
    case 'error':
      return { message: `Update check failed: ${event.message}`, tone: 'error' }
  }
}

interface UpdateStoreState {
  status: UpdateStatusEvent | null
  init: () => void
  check: () => Promise<void>
}

let unsubscribe: (() => void) | null = null

export const useUpdateStore = create<UpdateStoreState>((set) => ({
  status: null,
  init: () => {
    if (unsubscribe) return
    unsubscribe = window.api.autoUpdate.onStatus((event) => {
      set({ status: event })
      const { message, tone, sticky } = toastFor(event)
      useToastStore.getState().push(message, tone, { key: TOAST_KEY, sticky })
    })
  },
  check: async () => {
    set({ status: { kind: 'checking' } })
    await window.api.autoUpdate.check()
  }
}))
