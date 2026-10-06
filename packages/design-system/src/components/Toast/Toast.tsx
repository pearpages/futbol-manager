import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cx } from '../../cx.ts'
import { Button } from '../Button/Button.tsx'
import { Icon } from '../Icon/Icon.tsx'
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.tsx'
import './Toast.css'

/**
 * How long the live region stays empty before the message goes in. A region
 * inserted already holding its text is ignored by many screen readers; one that
 * exists first and then changes is announced.
 */
const ANNOUNCE_DELAY = 100

/**
 * Says something just happened, and offers to take it back.
 *
 * The alternative to a confirmation for what is cheap to reverse: you act at
 * full speed and learn what the button did, and undo is one press away. The
 * caller positions it.
 *
 * **A toast with an action waits.** It stays until the action or its close
 * button, because an undo that leaves on a timer is out of reach of anyone who
 * needs longer than six seconds to get to it (WCAG 2.2.1). A toast with nothing
 * to press goes by itself, and holds while the pointer or focus is on it.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  closeLabel,
  duration = 6000,
  className,
}: {
  readonly message: string
  readonly actionLabel?: string
  readonly onAction?: () => void
  readonly onDismiss: () => void
  /** Names the close (×) button. A toast with an action needs one, since it waits. */
  readonly closeLabel?: string
  /** Milliseconds before a toast with no action goes by itself. */
  readonly duration?: number
  readonly className?: string
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const hasAction = actionLabel !== undefined && onAction !== undefined
  const [held, setHeld] = useState(false)
  const [said, setSaid] = useState('')

  // The latest callback, read when the timer fires. Callers pass an inline
  // function, and as a dependency it would restart the clock on every render.
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })

  useEffect(() => {
    if (hasAction || held) return
    const id = setTimeout(() => {
      dismiss.current()
    }, duration)
    return () => {
      clearTimeout(id)
    }
  }, [duration, message, hasAction, held])

  useEffect(() => {
    setSaid('')
    const id = setTimeout(() => {
      setSaid(message)
    }, ANNOUNCE_DELAY)
    return () => {
      clearTimeout(id)
    }
  }, [message])

  // Leaving with focus on its button would drop a keyboard user onto `<body>`:
  // focus goes back to wherever it was when the toast arrived. A layout effect,
  // so the box is still in the document when the check runs.
  useLayoutEffect(() => {
    const before = document.activeElement
    const element = box.current
    return () => {
      if (element?.contains(document.activeElement) !== true) return
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [])

  return (
    <div
      ref={box}
      className={cx('panel toast', className)}
      onPointerEnter={() => {
        setHeld(true)
      }}
      onPointerLeave={() => {
        setHeld(false)
      }}
      onFocus={() => {
        setHeld(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false)
      }}
    >
      <span className="toast__message" aria-hidden="true">
        {message}
      </span>
      <VisuallyHidden role="status">{said}</VisuallyHidden>
      {hasAction && (
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
      {closeLabel !== undefined && (
        <Button type="button" className="toast__close" aria-label={closeLabel} onClick={onDismiss}>
          <Icon name="close" />
        </Button>
      )}
    </div>
  )
}
