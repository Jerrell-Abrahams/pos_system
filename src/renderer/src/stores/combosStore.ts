import { create } from 'zustand'
import type { Combo } from '@shared/types'

interface CombosState {
  combos: Combo[]
  loaded: boolean
  load: () => Promise<void>
}

export const useCombosStore = create<CombosState>((set) => ({
  combos: [],
  loaded: false,
  load: async () => {
    const combos = await window.api.promotions.list()
    set({ combos, loaded: true })
  }
}))
