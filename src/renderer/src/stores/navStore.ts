import { create } from 'zustand'

export type Screen =
  | 'pos'
  | 'products'
  | 'inventory'
  | 'salesHistory'
  | 'dashboard'
  | 'analytics'
  | 'promotions'
  | 'settings'
  | 'employees'
  | 'history'
  | 'displayManager'

export interface NavParams {
  productId?: number
  sortLowStock?: boolean
  voidedOnly?: boolean
  report?: string
}

interface NavState {
  screen: Screen
  params: NavParams | null
  // A screen with unsaved edits registers a blocker; returning false vetoes the navigation
  // (the blocker is expected to prompt the user and re-issue the nav itself if confirmed).
  blocker: ((target: Screen) => boolean) | null
  setBlocker: (fn: ((target: Screen) => boolean) | null) => void
  setScreen: (screen: Screen) => void
  navigate: (screen: Screen, params?: NavParams) => void
}

export const useNavStore = create<NavState>((set, get) => ({
  screen: 'pos',
  params: null,
  blocker: null,
  setBlocker: (fn) => set({ blocker: fn }),
  setScreen: (screen) => {
    const { blocker } = get()
    if (blocker && !blocker(screen)) return
    set({ screen, params: null })
  },
  navigate: (screen, params) => {
    const { blocker } = get()
    if (blocker && !blocker(screen)) return
    set({ screen, params: params ?? null })
  }
}))
