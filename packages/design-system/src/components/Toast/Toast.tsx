import { useEffect, useRef } from 'react'
import { cx } from '../../cx.ts'
import { Button } from '../Button/Button.tsx'
import './Toast.css'

/**
 * Says something just happened, and offers to take it back.
 *
 * The alternative to a confirmation for what is cheap to reverse: you act at
 * full speed and learn what the button did, and undo is one press away for a few
 * seconds. Dismisses itself; the caller positions it.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 6000,
  className,
}: {
  readonly message: string
  readonly actionLabel?: string
  readonly onAction?: () => void
  readonly onDismiss: () => void
  /** Milliseconds before it goes by itself. */
  readonly duration?: number
  readonly className?: string
}): React.JSX.Element {
  // The latest callback, read when the timer fires. Callers pass an inline
  // function, and as a dependency it would restart the clock on every render.
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })

  useEffect(() => {
    const id = setTimeout(() => {
      dismiss.current()
    }, duration)
    return () => {
      clearTimeout(id)
    }
  }, [duration, message])

  return (
    <div className={cx('panel toast', className)} role="status">
      <span className="toast__message">{message}</span>
      {actionLabel !== undefined && onAction !== undefined && (
        <Button
          type="button"
          className="toast__action"
          onClick={() => {
            onAction()
            onDismiss()
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
