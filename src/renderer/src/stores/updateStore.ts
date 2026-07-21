import { create } from 'zustand'
import type { UpdateStatusEvent } from '@shared/types'
import { useToastStore, type Toast } from './toastStore'

const TOAST_KEY = 'update-status'

// Only the in-progress download stays up until the user dismisses it -- every other status
// (checking, found, ready, up to date, error) is transient and can auto-dismiss like any toast.
function toastFor(event: UpdateStatusEvent): { message: string; tone: Toast['tone']; sticky?: boolean } {
  switch (event.kind) {
    case 'checking':
      return { message: 'Checking for updates…', tone: 'info' }
    case 'available':
      return { message: `Update v${event.version} found — downloading…`, tone: 'info' }
    case 'downloading':
      return { message: `Downloading update… ${event.percent}%`, tone: 'info', sticky: true }
    case 'downloaded':
      return { message: `Update v${event.version} ready — installs on next restart`, tone: 'success' }
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
