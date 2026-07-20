import { create } from 'zustand'
import type { EmployeeSession } from '@shared/types'
import { useNavStore } from './navStore'

interface AuthState {
  employee: EmployeeSession | null
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  employee: null,
  logout: () => {
    set({ employee: null })
    // A screen a manager was on (e.g. Employees) must not leak into whichever
    // session logs back in next — every fresh login starts at the main POS screen.
    useNavStore.setState({ screen: 'pos' })
  }
}))
