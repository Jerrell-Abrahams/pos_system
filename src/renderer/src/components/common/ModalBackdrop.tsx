import { useRef } from 'react'

interface ModalBackdropProps {
  onClose: () => void
  className?: string
  children: React.ReactNode
}

// Closes only when both the press and release happened on the backdrop itself. A plain click
// inside the panel never qualifies (the bubbled event's target is the child, not the backdrop),
// and neither does a drag that starts inside the panel and lets go past its edge -- e.g. selecting
// text in a field and overshooting the boundary -- since the browser resolves that click's target
// to the backdrop (the nearest common ancestor of mousedown and mouseup) even though the gesture
// began on the panel. Tracking where the press started is what catches that case.
export function ModalBackdrop({ onClose, className, children }: ModalBackdropProps): React.JSX.Element {
  const pressedBackdrop = useRef(false)

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${className ?? ''}`}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}
