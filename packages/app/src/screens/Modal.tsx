import { useEffect, useId, useRef } from 'react'
import '../styles/modal.css'

/**
 * The app's first dialog, and its first keyboard handling of any kind.
 *
 * Everything before this was a screen: the hub is the only branching point and a
 * screen fills the stage. A dialog is the right shape when the answer belongs
 * *over* what you were doing rather than instead of it — naming a save, or
 * confirming something you cannot undo — and neither of those is worth a title, a
 * Volver rail and a trip through the hub.
 *
 * Not a native `<dialog>`. `showModal()` and the top layer are unevenly
 * implemented across the environments this is tested in, and the whole point of a
 * primitive is that its behaviour is the same everywhere. A fixed overlay needs no
 * portal either, because `.shell` is a single column with nothing transformed
 * above it.
 */

/**
 * Everything that can take focus inside the box.
 *
 * `[href]` and `[tabindex]` are here for completeness rather than for a current
 * caller — a dialog is a primitive, and the next one will hold something this one
 * does not.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  readonly title: string
  readonly onClose: () => void
  /**
   * A box wide enough for a table.
   *
   * Two sizes because two shapes exist already and they want opposite things: a
   * question is a sentence and a pair of buttons, and stretching it to a table's
   * width makes it read as a form. Not a scale — add a third only when a third
   * case turns up.
   */
  readonly wide?: boolean
  readonly children: React.ReactNode
}

export function Modal({ title, onClose, wide = false, children }: ModalProps): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const headingId = useId()

  // Focus goes into the box on open and back to whatever opened it on close.
  // Without the second half, dismissing a dialog drops focus onto `<body>` and a
  // keyboard user starts again from the top of the page.
  useEffect(() => {
    const opener = document.activeElement
    box.current?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || box.current === null) return

      const focusable = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return

      // Three edges, not two. Focus starts on the *box*, which is not in the tab
      // order — so shift-Tab from there would leave the dialog backwards without
      // ever touching `first`.
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === box.current)) {
        last.focus()
        event.preventDefault()
      } else if (!event.shiftKey && active === last) {
        first.focus()
        event.preventDefault()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    // Dismissing by clicking away is a click on the backdrop itself — the test is
    // the target, not a class, so a click anywhere inside the box never closes it
    // however deeply nested the thing pressed was.
    <div
      className="modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`panel modal__box${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={box}
        tabIndex={-1}
      >
        <h2 className="modal__heading" id={headingId}>
          {title}
        </h2>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
