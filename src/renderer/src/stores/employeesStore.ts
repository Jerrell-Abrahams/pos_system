import { create } from 'zustand'
import type { EmployeeListItem } from '@shared/types'

interface EmployeesState {
  employees: EmployeeListItem[]
  loaded: boolean
  load: () => Promise<void>
}

export const useEmployeesStore = create<EmployeesState>((set) => ({
  employees: [],
  loaded: false,
  load: async () => {
    const employees = await window.api.employees.list()
    set({ employees, loaded: true })
  }
}))
