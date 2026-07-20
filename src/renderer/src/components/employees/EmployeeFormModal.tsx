import { useState } from 'react'
import type { EmployeeListItem, EmployeeRole } from '@shared/types'
import { useAuthStore } from '../../stores/authStore'
import { PinField } from '../common/PinField'

interface EmployeeFormModalProps {
  employee: EmployeeListItem | null
  onSaved: () => void
  onClose: () => void
}

export function EmployeeFormModal({ employee, onSaved, onClose }: EmployeeFormModalProps): React.JSX.Element {
  const currentEmployee = useAuthStore((s) => s.employee)
  const [name, setName] = useState(employee?.name ?? '')
  const [role, setRole] = useState<EmployeeRole>(employee?.role ?? 'cashier')
  const [active, setActive] = useState(employee?.active ?? true)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const valid = name.trim().length > 0 && (employee ? true : pin.length >= 4)

  async function save(): Promise<void> {
    if (!currentEmployee || !valid) return
    setSubmitting(true)
    setError('')
    try {
      if (employee) {
        await window.api.employees.update({
          id: employee.id,
          name: name.trim(),
          role,
          active,
          pin: pin.length > 0 ? pin : undefined,
          authorizedBy: currentEmployee.id
        })
      } else {
        await window.api.employees.create({
          name: name.trim(),
          pin,
          role,
          authorizedBy: currentEmployee.id
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-96 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-center text-lg font-semibold text-ink">{employee ? 'Edit Employee' : 'Add Employee'}</h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-ink-muted">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-border bg-bg px-3 text-ink focus:border-accent-border focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted">Role</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setRole('cashier')}
                className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
                  role === 'cashier' ? 'border-accent-border bg-accent-tint text-accent-light' : 'border-border text-ink-muted'
                }`}
              >
                Cashier
              </button>
              <button
                type="button"
                onClick={() => setRole('manager')}
                className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
                  role === 'manager' ? 'border-accent-border bg-accent-tint text-accent-light' : 'border-border text-ink-muted'
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          <PinField
            label="PIN"
            hint={employee ? 'Leave blank to keep current PIN' : 'Tap to set a 4–6 digit PIN'}
            hasValue={pin.length > 0}
            onChange={setPin}
          />

          {employee && (
            <button
              type="button"
              onClick={() => setActive((a) => !a)}
              className={`h-12 w-full rounded-xl border text-sm font-medium ${
                active ? 'border-border text-ink-muted' : 'border-danger text-danger'
              }`}
            >
              {active ? 'Active — tap to deactivate' : 'Inactive — tap to reactivate'}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || submitting}
            onClick={() => void save()}
            className="h-14 flex-1 rounded-xl bg-accent text-sm font-semibold text-bg active:bg-accent-light disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
