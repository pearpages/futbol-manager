import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/useT.ts'
import { EXPLAIN_TOPICS, type ExplainTopic, type ExplainTopicId } from './explain-topics.ts'
import { Modal } from './Modal.tsx'

/**
 * A small "i" beside something the game has not explained, which opens the
 * explanation over the screen.
 *
 * The app already puts prose next to a control wherever there is room — Caja,
 * Estadio and the ficha all do. This exists for everywhere there is not: the
 * squad table has ten columns and no note region at all, and the lineup screen
 * fought over three rows of text and lost, demoting its one sentence about the
 * match model into a `title` attribute nobody hovers.
 *
 * **The glyph is `aria-hidden` and the button carries its own label**, and that
 * is load-bearing rather than tidy. Two dozen assertions across the suite resolve
 * a control by its *exact* accessible name, and `openScreen()` matches whole
 * strings — a stray "i" folded into a neighbouring heading renames it and takes
 * whole suites down. For the same reason this never goes inside a `<th>` that
 * already holds a sort button: it would rename the column.
 *
 * Reuses `Modal` rather than growing a second dialog. That primitive already
 * handles Escape, the focus trap, backdrop dismissal and returning focus to
 * whatever opened it, and `SaveManagerModal` records that two stacked overlays
 * are a shape this app has no answer for.
 *
 * **The dialog is portalled, and the reason is not stacking.** `Modal` says a
 * portal is unnecessary because `.shell` is a single column with nothing
 * transformed above it, and for its own callers that is true — they all render
 * from an ordinary `<div>`. This one does not: the "i" belongs beside a heading
 * or a stat label, so without a portal the dialog is a child of an `<h2>` or a
 * `.stat__label` and inherits `text-transform: uppercase` and the condensed
 * face. Nine paragraphs of body copy rendered in shouting condensed capitals,
 * and it is invalid markup besides — a `role="dialog"` inside a heading. The
 * suite could not see either; a screenshot could.
 */

interface ExplainProps {
  readonly topic: ExplainTopicId
}

export function Explain({ topic }: ExplainProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const translator = useT()
  const { t } = translator

  const title = t(`explain.${topic}.title`)
  // Widened to the interface deliberately: only some topics declare `params`, and
  // reading it off the const union would need a narrowing that says nothing.
  const spec: ExplainTopic = EXPLAIN_TOPICS[topic]
  // Resolved once per render rather than per paragraph — every sentence in a
  // topic draws on the same set of live values.
  const values = spec.params?.(translator)

  return (
    <>
      <button
        type="button"
        className="explain"
        aria-label={t('explain.open', { topic: title })}
        onClick={() => {
          setOpen(true)
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open &&
        createPortal(
          <Modal
            title={title}
            onClose={() => {
              setOpen(false)
            }}
          >
            {Array.from({ length: spec.paragraphs }, (_, index) => (
              <p className="screen__note" key={index}>
                {t(`explain.${topic}.p${String(index + 1)}`, values)}
              </p>
            ))}
            {/* Sticky, because the longest topic runs past the height of the box
                and the close button would otherwise sit below nine paragraphs of
                scroll. Escape and the backdrop still work; an affordance you have
                to go looking for is not one. */}
            <div className="screen-actions explain__actions">
              <button
                type="button"
                className="button is-primary"
                onClick={() => {
                  setOpen(false)
                }}
              >
                {t('action.close')}
              </button>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  )
}
