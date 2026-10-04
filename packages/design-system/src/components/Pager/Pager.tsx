import type { ReactNode } from 'react'

/**
 * Back, where you are, forward.
 *
 * Two screens step through a list one slice at a time — the matchday navigator on
 * `ResultsScreen` and the market's page control — so the control graduated here on
 * its second use, which is where this project moves a primitive.
 *
 * **The label is a sibling of the buttons, never inside one.** Not for the accessible
 * name — a mutation sweep folding it into the prev button failed nothing, because
 * `aria-label` overrides an element's contents outright, so this is *not* another
 * `CanteraM7`. The reason is plainer: content inside a button is part of the button,
 * so reading the page number would page you, and `ResultsScreen`'s label is an `<h2>`
 * that has no business nested in a control.
 *
 * The glyphs are `aria-hidden`: each button's accessible name is its `aria-label`
 * and nothing else, because both screens' tests resolve these controls by it.
 */
export function Pager({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  atStart,
  atEnd,
  className,
  children,
}: {
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
  atStart: boolean
  atEnd: boolean
  /** Screen-local layout — a boundary rule, not the control's own appearance. */
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className === undefined ? 'pager' : `pager ${className}`}>
      <button
        type="button"
        className="button"
        disabled={atStart}
        aria-label={prevLabel}
        onClick={onPrev}
      >
        <span aria-hidden="true">◀</span>
      </button>
      {children}
      <button
        type="button"
        className="button"
        disabled={atEnd}
        aria-label={nextLabel}
        onClick={onNext}
      >
        <span aria-hidden="true">▶</span>
      </button>
    </div>
  )
}
