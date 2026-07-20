import { useEffect, useState } from 'react'
import type { EmployeeListItem } from '@shared/types'
import { useEmployeesStore } from '../../stores/employeesStore'
import { EmployeeFormModal } from './EmployeeFormModal'

export function EmployeesScreen(): React.JSX.Element {
  const employees = useEmployeesStore((s) => s.employees)
  const loaded = useEmployeesStore((s) => s.loaded)
  const load = useEmployeesStore((s) => s.load)
  const [editing, setEditing] = useState<EmployeeListItem | null | 'new'>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  function handleSaved(): void {
    setEditing(null)
    void load()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Employees</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="h-16 rounded-xl bg-accent px-6 text-sm font-semibold text-bg active:bg-accent-light"
        >
          Add Employee
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {employees.map((emp) => (
          <button
            key={emp.id}
            type="button"
            onClick={() => setEditing(emp)}
            className={`flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-left ${
              emp.active ? '' : 'opacity-50'
            }`}
          >
            <p className="text-sm font-medium text-ink">
              {emp.name} {!emp.active && <span className="text-danger">(inactive)</span>}
            </p>
            <span className="text-xs uppercase tracking-wide text-ink-muted">{emp.role}</span>
          </button>
        ))}
        {employees.length === 0 && <p className="pt-8 text-center text-sm text-ink-muted">No employees found</p>}
      </div>

      {editing !== null && (
        <EmployeeFormModal
          employee={editing === 'new' ? null : editing}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
