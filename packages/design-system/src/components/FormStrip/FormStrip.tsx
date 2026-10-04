import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.tsx'
import './FormStrip.css'

/** One square: a result, or a match not yet played (`outcome: null`). */
export interface FormPip {
  readonly key: string
  readonly outcome: 'win' | 'draw' | 'loss' | null
  /** The whole sentence, for the tooltip and for screen readers. */
  readonly text: string
}

/**
 * The latest results as coloured squares — won, drew, lost, or not yet played.
 *
 * **A fixed number of cells**, padded by the caller with blanks at the *left*, so the
 * most recent result is always the rightmost square and the row does not shuffle
 * sideways as a season fills up. Oldest to newest is the form-guide convention every
 * league table uses.
 *
 * Colour is never the only signal — the house rule stated in `chrome.css` beside the
 * notice tones. Each played square carries the same sentence the news feed writes for
 * that match, as a `title` and for assistive technology.
 */
export function FormStrip({
  label,
  pips,
}: {
  /** The list's accessible name ("Latest results"). */
  readonly label: string
  /** Oldest first; blanks before the first result. */
  readonly pips: readonly FormPip[]
}) {
  return (
    <ul className="form-strip" aria-label={label}>
      {pips.map((pip) => (
        <li
          key={pip.key}
          className={pip.outcome === null ? 'form-strip__pip' : `form-strip__pip is-${pip.outcome}`}
          title={pip.text}
        >
          <VisuallyHidden>{pip.text}</VisuallyHidden>
        </li>
      ))}
    </ul>
  )
}
