import { type ClubResult } from '@fm/domain'
import { type Translator } from '../i18n/useT.ts'
import { VisuallyHidden } from '@fm/design-system'

/** How many matches the strip shows — about a quarter of a season's shape. */
export const FORM_MATCHES = 10

/**
 * The last five results as coloured squares — won, drew, lost, or not yet played.
 *
 * **Always `FORM_MATCHES` cells**, padded with grey at the *left*, so the most recent
 * result is always the rightmost square and the row does not shuffle sideways as a
 * season fills up. Oldest to newest is the form-guide convention every league table uses.
 *
 * Colour is never the only signal — the house rule stated in `chrome.css` beside the
 * notice tones. Each played square carries the same sentence the news feed writes for
 * that match, as a `title` and for assistive technology.
 */
export function FormStrip({
  results,
  names,
  translator,
}: {
  results: readonly ClubResult[]
  names: (id: ClubResult['opponentId']) => string
  translator: Translator
}) {
  const { t, club } = translator
  const blanks = Math.max(0, FORM_MATCHES - results.length)

  return (
    <ul className="form-strip" aria-label={t('table.latestResults')}>
      {Array.from({ length: blanks }, (_, i) => (
        <li key={`blank-${String(i)}`} className="form-strip__pip" title={t('form.notPlayed')}>
          <VisuallyHidden>{t('form.notPlayed')}</VisuallyHidden>
        </li>
      ))}
      {results.map((result) => {
        // The feed's own wording, so one fact is worded once. `news.won` and friends
        // already exist in all three dictionaries with exactly these parameters.
        const sentence = t(
          result.outcome === 'win'
            ? 'news.won'
            : result.outcome === 'loss'
              ? 'news.lost'
              : 'news.drew',
          {
            opponent: club(names(result.opponentId)),
            ours: result.ours,
            theirs: result.theirs,
          },
        )

        return (
          <li
            key={result.fixtureId}
            className={`form-strip__pip is-${result.outcome}`}
            title={sentence}
          >
            <VisuallyHidden>{sentence}</VisuallyHidden>
          </li>
        )
      })}
    </ul>
  )
}
