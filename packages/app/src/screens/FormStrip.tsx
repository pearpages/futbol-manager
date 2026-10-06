import { type FormPip, FormStrip as FormStripView } from '@fm/design-system'
import { type ClubResult } from '@fm/domain'
import { type Translator } from '../i18n/useT.ts'

/** How many matches the strip shows — about a quarter of a season's shape. */
export const FORM_MATCHES = 10

/**
 * A club's latest results: the design system's strip, padded to `FORM_MATCHES`.
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

  const pips: FormPip[] = [
    ...Array.from({ length: blanks }, (_, i) => ({
      key: `blank-${String(i)}`,
      outcome: null,
      text: t('form.notPlayed'),
    })),
    ...results.map((result) => ({
      key: result.fixtureId,
      outcome: result.outcome,
      // The table's own column letters, so the strip and the table agree.
      mark: t(
        result.outcome === 'win'
          ? 'table.column.won'
          : result.outcome === 'loss'
            ? 'table.column.lost'
            : 'table.column.drawn',
      ),
      // The feed's own wording, so one fact is worded once. `news.won` and friends
      // already exist in all three dictionaries with exactly these parameters.
      text: t(
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
      ),
    })),
  ]

  return <FormStripView label={t('table.latestResults')} pips={pips} />
}
