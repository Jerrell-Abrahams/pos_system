import { useRef, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'

interface Position {
  left: number
  top: number
}

const MARGIN = 16

export function EmployeePill(): React.JSX.Element | null {
  const employee = useAuthStore((s) => s.employee)
  const pillRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [position, setPosition] = useState<Position | null>(null)

  function clamp(left: number, top: number): Position {
    const width = pillRef.current?.offsetWidth ?? 0
    const height = pillRef.current?.offsetHeight ?? 0
    return {
      left: Math.min(Math.max(left, 0), window.innerWidth - width),
      top: Math.min(Math.max(top, 0), window.innerHeight - height)
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    const rect = pillRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { pointerId: e.pointerId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    setPosition(clamp(e.clientX - drag.offsetX, e.clientY - drag.offsetY))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  if (!employee) return null

  return (
    <div
      ref={pillRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={position ? { left: position.left, top: position.top } : { left: MARGIN, bottom: MARGIN }}
      className="fixed z-50 cursor-grab touch-none select-none rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-surface shadow-lg active:cursor-grabbing"
    >
      {employee.name} · {employee.role}
    </div>
  )
}
