import { create } from 'zustand'

export interface Toast {
  id: number
  key?: string
  message: string
  tone: 'info' | 'error' | 'success'
  sticky?: boolean
}

interface ToastOptions {
  // Updates an existing toast with the same key in place instead of stacking a new one --
  // for a status that changes repeatedly (like download progress) rather than a one-off event.
  key?: string
  // Skips the auto-dismiss timer; stays until replaced (via key) or dismissed by hand.
  sticky?: boolean
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone'], options?: ToastOptions) => void
  dismiss: (id: number) => void
}

let nextId = 1
const AUTO_DISMISS_MS = 6000

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info', options) => {
    const existing = options?.key ? get().toasts.find((t) => t.key === options.key) : undefined
    if (existing) {
      set((state) => ({
        toasts: state.toasts.map((t) => (t.id === existing.id ? { ...t, message, tone, sticky: options?.sticky } : t))
      }))
      return
    }
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, key: options?.key, message, tone, sticky: options?.sticky }] }))
    if (!options?.sticky) setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))
