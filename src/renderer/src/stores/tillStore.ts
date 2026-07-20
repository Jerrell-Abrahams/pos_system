import { create } from 'zustand'
import type { OpenTillInfo, TillCloseResult } from '@shared/types'

interface TillState {
  checked: boolean
  till: OpenTillInfo | null
  refresh: () => Promise<void>
  open: (employeeId: number, openingCashCents: number) => Promise<void>
  close: (employeeId: number, closingCashCents: number) => Promise<TillCloseResult>
}

export const useTillStore = create<TillState>((set) => ({
  checked: false,
  till: null,
  refresh: async () => {
    const status = await window.api.till.status()
    set({ till: status.till, checked: true })
  },
  open: async (employeeId, openingCashCents) => {
    const status = await window.api.till.open({ employeeId, openingCashCents })
    set({ till: status.till, checked: true })
  },
  close: async (employeeId, closingCashCents) => {
    const result = await window.api.till.close({ employeeId, closingCashCents })
    set({ till: null })
    return result
  }
}))
