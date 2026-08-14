import { fireEvent, screen } from '@testing-library/react'
import { translatorFor } from './i18n/useT.ts'
import { useGame } from './store.ts'

/**
 * Helpers shared across the screen tests.
 *
 * Not a `.test.ts` file, so Vitest does not collect it.
 */

/**
 * The shell's primary button reads differently depending on the day, so a test
 * that wants to move the clock cannot ask for it by one name.
 *
 * - `Advance day` — an ordinary day
 * - `Play match v Sevilla (H)` — your fixture is due, and kicking off is a
 *   separate, deliberate press
 * - `Start 2027/28` — the season is over
 *
 * Round one is dated on the season start, so a brand new career opens on
 * **Play match**, never on Advance day.
 */
export const ADVANCE = () => {
  const { t } = translatorFor(useGame.getState().language)
  // Built from the dictionary rather than typed out, so it follows whatever
  // language the app is in. The three labels share no prefix, so this is an
  // alternation of the three rendered forms with their parameters stripped.
  const stem = (key: string) => t(key, { opponent: '', season: '' }).trim()
  return new RegExp(
    `^(${[stem('hub.advanceDay'), stem('hub.playMatch'), stem('hub.startSeason')]
      .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})`,
  )
}

/**
 * Opens a screen the way a player does — from a hub tile.
 *
 * Takes the tile's **dictionary key**, not its label. Thirty-five call sites used
 * to spell out `'Fichar'`, which stopped working the moment the app had three
 * languages and a Catalan default. Resolving through the same dictionary the UI
 * renders from means a test never has to know which language it is in.
 *
 * There is no nav rail: the hub is the only branching point, so every test that
 * wants a screen has to start from the hub and come `back()` afterwards.
 */
export function openScreen(tileKey: string): void {
  const { t } = translatorFor(useGame.getState().language)
  fireEvent.click(screen.getByRole('button', { name: t(tileKey) }))
}

/** Volver — back to the hub, or on a ficha, back to wherever it was opened from. */
export function back(): void {
  const { t } = translatorFor(useGame.getState().language)
  fireEvent.click(screen.getByRole('button', { name: t('action.back') }))
}

/**
 * Presses whatever the primary button currently says, `times` times.
 *
 * **Only works on the hub.** The day controls live there and nowhere else, so a
 * test standing on another screen must `back()` first.
 */
export function advance(times = 1): void {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole('button', { name: ADVANCE() }))
  }
}

/** Presses it until `done()` holds, or the guard trips. Returns the presses used. */
export function advanceUntil(done: () => boolean, limit = 400): number {
  for (let i = 0; i < limit; i++) {
    if (done()) return i
    fireEvent.click(screen.getByRole('button', { name: ADVANCE() }))
  }
  throw new Error(`still not done after ${limit} presses`)
}

/**
 * The fixed part of a label that ends in `· {value}`.
 *
 * Several controls put the live value in their own label — the ticket price, the
 * expansion size — so a test cannot ask for the whole string. This takes the
 * stem, which is the part that does not move.
 */
export function labelStem(text: string): RegExp {
  return new RegExp((text.split('·')[0] ?? text).trim())
}
