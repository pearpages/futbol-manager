import { useState } from 'react'
import { type Event, type GameState, isGameError } from '@fm/domain'
import { describe as describeEvent, lookupFor } from './notifications.ts'
import type { Translator } from './i18n/useT.ts'

/**
 * Dispatching a command and saying what happened when it did not work.
 *
 * **Two different things can go wrong and only one of them throws.** A command the
 * reducer *refuses* throws a `GameError` — a rule you broke, and its code is the
 * useful part. A command it *accepts* can still not get you what you wanted: terms
 * a player turns down come back as a `TermsRejected` event with the state
 * untouched, and nothing is thrown at all.
 *
 * That second case is why this exists at all. Before the shell's news drawer went
 * it at least lit a badge; now the only feed is on the hub, a different screen from
 * the one the button is on, so without this a refused offer reads as a dead button.
 * That was a shipped defect, not a hypothetical.
 *
 * Graduated from `MarketScreen` and `EstadioScreen` when the renewal dialog became
 * the third caller — the same rule `chrome.css` states for its own primitives.
 * `EstadioScreen` only ever throws, and it costs nothing to hand it the richer
 * version: an action that emits no `TermsRejected` simply clears the error.
 */
export interface Attempt {
  /** The refusal to show, or `null` when the last attempt was fine. */
  readonly error: string | null
  /**
   * Run a dispatch, capturing either failure mode.
   *
   * Returns what the reducer emitted, or `undefined` if it threw — so a caller
   * that has to *do* something on success (close a dialog, reset a field) can ask
   * rather than guess. A refusal returns its events too: `TermsRejected` is an
   * outcome, and the distinction the caller wants is "did the thing I asked for
   * actually happen", which only the event list answers.
   */
  attempt(action: () => readonly Event[] | void): readonly Event[] | undefined
  clear(): void
}

export function useAttempt(game: GameState, translator: Translator): Attempt {
  const [error, setError] = useState<string | null>(null)
  const { t } = translator

  function attempt(action: () => readonly Event[] | void): readonly Event[] | undefined {
    try {
      const events = action() ?? []
      const outcome = events.find((event) => event.type === 'TermsRejected')
      // Reuse the feed's own sentence rather than writing a second one for the
      // same event; `describe` already resolves his name and what he wants.
      setError(
        outcome === undefined
          ? null
          : (describeEvent(outcome, game, lookupFor(game, translator), translator)?.text ?? null),
      )
      return events
    } catch (thrown) {
      // A refusal carries a code; the sentence it also carries is the fallback for
      // anything that has not been given one.
      setError(
        isGameError(thrown)
          ? t(thrown.code, thrown.params)
          : thrown instanceof Error
            ? thrown.message
            : t('error.unknown'),
      )
      return undefined
    }
  }

  return { error, attempt, clear: () => setError(null) }
}
