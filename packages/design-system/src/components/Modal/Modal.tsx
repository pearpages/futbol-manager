import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePhone } from '../../usePhone.ts'
import { Icon } from '../Icon/Icon.tsx'
import './Modal.css'

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
 * primitive is that its behaviour is the same everywhere.
 *
 * **Rendered into `document.body`.** A fixed overlay escapes its parent's box but
 * not its stacking context: opened from the phone bar's menu, which is sticky
 * with a z-index, the save picker drew under the action bar and the tabs.
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
  /**
   * On a phone, the whole screen rather than a sheet from the bottom: for lists
   * and forms (the saves, all the news, an explanation), which a sheet would
   * show a few lines of. The desk is unchanged. Needs `closeLabel`, because a
   * full-screen dialog leaves no backdrop to tap.
   */
  readonly full?: boolean
  /** Shows a close (×) button in the heading, named by this. */
  readonly closeLabel?: string
  readonly children: React.ReactNode
}

/** How many dialogs are open, so nested ones release the page only once. */
let openCount = 0

/**
 * The open dialogs' overlays, oldest first. Only the last one answers Escape, and
 * everything else in `<body>` is `inert` while it is up: `aria-modal` alone does
 * not keep VoiceOver on iOS inside the box, and one Escape used to close every
 * dialog in a stack at once.
 */
const stack: HTMLElement[] = []

function shield(): void {
  const top = stack.at(-1)
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue
    if (top === undefined || child === top) child.removeAttribute('inert')
    else child.setAttribute('inert', '')
  }
}

export function Modal({
  title,
  onClose,
  wide = false,
  full = false,
  closeLabel,
  children,
}: ModalProps): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const phone = usePhone()

  // The page behind does not scroll while a dialog is up: on a phone a swipe
  // inside a sheet otherwise scrolled the screen under the scrim.
  useEffect(() => {
    const root = document.documentElement
    if (openCount === 0) root.classList.add('has-modal')
    openCount += 1
    return () => {
      openCount -= 1
      if (openCount === 0) root.classList.remove('has-modal')
    }
  }, [])

  useEffect(() => {
    const element = overlay.current
    if (element === null) return
    stack.push(element)
    shield()
    return () => {
      stack.splice(stack.indexOf(element), 1)
      shield()
    }
  }, [])

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
      // Only the dialog on top: the one under it is not the one being looked at.
      if (overlay.current !== stack.at(-1)) return
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || box.current === null) return

      // Visible ones only: the close button is in the markup on a desk but not
      // shown there, and focusing it would drop focus out of sight.
      const focusable = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.checkVisibility?.() ?? true,
      )
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

  return createPortal(
    // Dismissing by clicking away is a click on the backdrop itself — the test is
    // the target, not a class, so a click anywhere inside the box never closes it
    // however deeply nested the thing pressed was.
    <div
      ref={overlay}
      className={`modal${full ? ' is-full' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`panel modal__box${wide ? ' is-wide' : ''}${full ? ' is-full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={box}
        tabIndex={-1}
      >
        <div className="modal__head">
          <h2 className="modal__heading" id={headingId}>
            {title}
          </h2>
          {/* Phone only: on a desk the backdrop and Escape close it, and the
              dialog's own buttons are a press away. */}
          {phone && full && closeLabel !== undefined && (
            <button
              type="button"
              className="button modal__close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
