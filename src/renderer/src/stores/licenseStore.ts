import { create } from 'zustand'
import type { LicenseReason } from '@shared/types'

type GateStatus = 'checking' | 'unactivated' | 'blocked' | 'ok'

interface LicenseStoreState {
  status: GateStatus
  reason: LicenseReason | null
  periodEnd: string | null
  init: () => void
  activate: (email: string, password: string) => Promise<void>
  recheck: () => Promise<void>
  logout: () => Promise<void>
}

function statusFor(entitled: boolean, reason: LicenseReason | null): GateStatus {
  if (entitled) return 'ok'
  return reason === 'not_activated' ? 'unactivated' : 'blocked'
}

let unsubscribe: (() => void) | null = null

export const useLicenseStore = create<LicenseStoreState>((set) => ({
  status: 'checking',
  reason: null,
  periodEnd: null,
  init: () => {
    if (unsubscribe) return
    window.api.license
      .getState()
      .then((state) =>
        set({ status: statusFor(state.entitled, state.reason), reason: state.reason, periodEnd: state.periodEnd })
      )
    unsubscribe = window.api.license.onState((state) =>
      set({ status: statusFor(state.entitled, state.reason), reason: state.reason, periodEnd: state.periodEnd })
    )
  },
  activate: async (email, password) => {
    const state = await window.api.license.activate({ email, password })
    set({ status: statusFor(state.entitled, state.reason), reason: state.reason, periodEnd: state.periodEnd })
  },
  recheck: async () => {
    set({ status: 'checking' })
    const state = await window.api.license.recheck()
    set({ status: statusFor(state.entitled, state.reason), reason: state.reason, periodEnd: state.periodEnd })
  },
  logout: async () => {
    await window.api.license.deactivate()
    set({ status: 'unactivated', reason: 'not_activated', periodEnd: null })
  }
}))
