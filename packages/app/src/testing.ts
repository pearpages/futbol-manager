import { fireEvent, screen } from '@testing-library/react'

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
export const ADVANCE = /^(Advance day|Play match|Start \d{4})/

/**
 * Opens a screen the way a player does — from a hub tile.
 *
 * There is no nav rail: the hub is the only branching point, so every test that
 * wants a screen has to start from the hub and come `back()` afterwards.
 */
export function openScreen(tile: string): void {
  fireEvent.click(screen.getByRole('button', { name: tile }))
}

/** Volver — back to the hub, or on a ficha, back to wherever it was opened from. */
export function back(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
}

/**
 * Presses whatever the primary button currently says, `times` times.
 *
 * **Only works on the hub.** The day controls live there and nowhere else, so a
 * test standing on another screen must `back()` first.
 */
export function advance(times = 1): void {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole('button', { name: ADVANCE }))
  }
}

/** Presses it until `done()` holds, or the guard trips. Returns the presses used. */
export function advanceUntil(done: () => boolean, limit = 400): number {
  for (let i = 0; i < limit; i++) {
    if (done()) return i
    fireEvent.click(screen.getByRole('button', { name: ADVANCE }))
  }
  throw new Error(`still not done after ${limit} presses`)
}
