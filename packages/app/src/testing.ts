import { fireEvent, screen, within } from '@testing-library/react'
import { translatorFor } from './i18n/useT.ts'
import { TABS } from './shell/tabs.ts'
import { useGame } from './store.ts'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
 *
 * The three no longer share one button — Play match and Start season are the
 * hub's, Advance day is the footer's — but they still never render together, so
 * the alternation still resolves to exactly one control.
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
 * Opens a screen the way a player does: its place in the tab bar (the rail on
 * the desk), then its segment if the place holds more than one (ADR 0022).
 *
 * Takes the screen's **dictionary key** (`nav.market`), not a label, so a test
 * never has to know which language it is in.
 */
export function openScreen(screenKey: string): void {
  const { t } = translatorFor(useGame.getState().language)
  const target = screenKey.replace(/^nav\./, '')
  const place = TABS.find((entry) => entry.screens.some((s) => s === target))
  if (place === undefined) throw new Error(`no place holds ${screenKey}`)
  const tabs = within(screen.getByRole('navigation', { name: t('tab.nav') }))
  // Starts with the label: the market's tab also names its waiting offers.
  fireEvent.click(tabs.getByRole('button', { name: new RegExp(`^${escape(t(place.label))}`) }))
  if (place.screens[0] !== target) {
    const segments = within(screen.getByRole('group', { name: t(place.label) }))
    fireEvent.click(segments.getByRole('button', { name: t(screenKey) }))
  }
}

/** Back from a player page to where it was opened; anywhere else, to Avui. */
export function back(): void {
  const { t } = translatorFor(useGame.getState().language)
  const backButton = screen.queryByRole('button', { name: t('action.back') })
  if (backButton !== null) {
    fireEvent.click(backButton)
    return
  }
  const tabs = within(screen.getByRole('navigation', { name: t('tab.nav') }))
  fireEvent.click(tabs.getByRole('button', { name: new RegExp(`^${escape(t('tab.today'))}`) }))
}

/** Closes the result sheet a played match opens, so the next press reaches the bar. */
export function dismissResult(): void {
  const { t } = translatorFor(useGame.getState().language)
  const sheet = screen.queryByRole('dialog', { name: t('result.title') })
  if (sheet !== null) {
    fireEvent.click(within(sheet).getByRole('button', { name: t('result.continue') }))
  }
}

/** Presses whatever the day's action currently says, `times` times. */
export function advance(times = 1): void {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole('button', { name: ADVANCE() }))
    dismissResult()
  }
}

/** Presses it until `done()` holds, or the guard trips. Returns the presses used. */
export function advanceUntil(done: () => boolean, limit = 400): number {
  for (let i = 0; i < limit; i++) {
    if (done()) return i
    fireEvent.click(screen.getByRole('button', { name: ADVANCE() }))
    dismissResult()
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

/**
 * Text queries that must not match a club badge's tooltip.
 *
 * Every badge carries `<title>{club.name}</title>` for the hover tooltip, and a
 * `<title>` joins the SVG's `textContent` — so a bare `getByText(club.name)`
 * finds both the visible name beside the badge *and* the tooltip inside it, and
 * throws on the duplicate. Testing Library's `ignore` defaults to
 * `'script, style'`; this extends it rather than replacing it.
 *
 * Reach for this whenever a test resolves a **club** by its rendered name. It is
 * not needed for player names, for `getAllByText`, or for a query already scoped
 * by `selector` or `within`.
 */
export const IGNORE_TOOLTIP = { ignore: 'script, style, title' } as const

/**
 * Says yes to the confirmation that is open: its last button, because a
 * `Confirm` puts cancel first and the action last.
 */
export const confirm = () => {
  const buttons = within(screen.getByRole('dialog')).getAllByRole('button')
  fireEvent.click(buttons.at(-1) as HTMLElement)
}
