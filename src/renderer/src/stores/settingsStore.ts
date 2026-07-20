import { create } from 'zustand'
import type { SettingsPayload } from '@shared/types'

interface SettingsState extends SettingsPayload {
  loaded: boolean
  load: () => Promise<void>
}

const DEFAULTS: SettingsPayload = {
  businessName: '',
  businessAddress: '',
  businessNumber: '',
  vatEnabled: true,
  vatRatePercent: 15,
  vatNumber: '',
  autoLockSeconds: 90,
  discountThresholdPercent: 20,
  cashVarianceThresholdCents: 5000,
  receiptFooter: '',
  printerInterface: '',
  backupFolder: '',
  cardTerminals: []
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const settings = await window.api.settings.getAll()
    set({ ...settings, loaded: true })
  }
}))
