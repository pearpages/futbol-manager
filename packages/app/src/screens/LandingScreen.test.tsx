import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advance, confirm } from '../testing.ts'

/**
 * The front door.
 *
 * `test-setup.ts` pins `entry: 'app'` for every other test in the suite, for the
 * same reason it pins the language: a market-screen test that also has to walk
 * through a door fails for a reason it is not about. That pin makes this file the
 * only place the door is exercised, so it walks all three ways through — and
 * asserts the *initial* value in `store.ts`, which the pin otherwise hides.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t } = translatorFor('en')
const atDoor = () => useGame.setState({ entry: 'landing' })
const cover = () => document.querySelector('.cover')
const settled = () => waitFor(() => expect(useGame.getState().saving).toBe(false))

beforeEach(() => {
  useGame.getState().newGame(MID)
  // `test-setup.ts` does not reset this one, and it is a module-level singleton —
  // the storage-blocked case below would otherwise leak into whatever ran next.
  useGame.setState({ storageBlocked: false })
  atDoor()
})

describe('the front door', () => {
  it('is where a brand new player starts', () => {
    // The pin in `test-setup.ts` makes the live store unreadable on this point, so
    // this reads the source. Without it the pin could mask a regression that
    // flipped the default and nobody would ever see the landing again.
    //
    // Two spaces exactly, and that matters: `quitToLanding` sets the same field to
    // the same value six spaces in, so a `\s+` here matched that instead and this
    // test passed with the initial value flipped to 'app'.
    const store = readFileSync(resolve(process.cwd(), 'packages/app/src/store.ts'), 'utf8')
    // Searched forward from `create<Store>`: `dispatch(` also appears in the
    // interface far above it, and slicing to that gave an empty string that
    // matched nothing and failed for the wrong reason.
    const from = store.indexOf('create<Store>')
    const initial = store.slice(from, store.indexOf('\n  dispatch(', from))
    expect(initial).toMatch(/^ {2}entry: 'landing',$/m)
  })

  it('shows the cover and says what the game is', () => {
    render(<App />)
    expect(cover()).not.toBeNull()
    // Decoration, like every other drawing here — the name is announced by the
    // heading instead, so it is not said twice.
    expect(cover()?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('heading', { level: 1, name: t('shell.wordmark') })).toBeDefined()
    expect(screen.getByText(t('landing.about.p1'))).toBeDefined()
  })

  it('sets the name as real text over the picture, not painted into it', () => {
    render(<App />)
    // **The half a screenshot cannot check and a test can.** The old cover drew
    // the lettering into the art and the heading was `visually-hidden` to avoid
    // saying the name twice. Now the heading *is* the wordmark, so it has to be
    // the visible one — leave the old class on it and the front door renders a
    // painting with no title at all, while every assertion above still passes.
    const heading = screen.getByRole('heading', { level: 1, name: t('shell.wordmark') })
    expect(heading.className).toContain('landing__wordmark')
    expect(heading.className).not.toContain('visually-hidden')

    // Decorative, so it carries an empty `alt` as well as `aria-hidden` — a
    // missing `alt` makes a screen reader read the file name instead.
    expect(cover()?.getAttribute('alt')).toBe('')
    expect(cover()?.getAttribute('src')).toBe('/cover.webp')
  })

  it('spells the name without the accent, in every language', () => {
    // Asked for explicitly. The bar, the browser tab and the cover all render
    // from this one key, so one spelling reaches all three.
    for (const language of ['ca', 'es', 'en'] as const) {
      expect(translatorFor(language).t('shell.wordmark')).toBe('Futbol Manager')
    }
  })

  it('ships the cover as one asset inside a first-paint budget', () => {
    // The replacement for the deleted rect budget. This lands on first paint with
    // nothing else on the screen, so it is the one asset whose weight is felt.
    // Measured 197 KB at q86 — the quality is deliberately high because the art is
    // painted grain, which is exactly what WebP smears first.
    const bytes = statSync(resolve(process.cwd(), 'packages/app/public/cover.webp')).size
    expect(bytes).toBeLessThan(300 * 1024)
  })

  it('is capped by the space available in both directions, with no jump', () => {
    // The pixel cover stepped its width at two measured viewport heights, and
    // those steps were wrong for a picture: at 1440x723 — any window that is not
    // maximised — the first one fired and shrank the cover to 48rem inside a
    // 1016px column with 112px of vertical room going spare. Measured in a real
    // browser, which is the only place it was ever visible.
    //
    // A single cap derived from the height available subsumes both and cannot be
    // wrong at a size nobody measured, so the height queries must not come back.
    const css = readFileSync(
      resolve(process.cwd(), 'packages/app/src/screens/LandingScreen.css'),
      'utf8',
    )
    expect(css).toContain('max-width: min(64rem, calc((100dvh - 5rem) * 1.75))')
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/@media \(height/)
    // Display lettering, and the reason the dictionary can stay title case.
    expect(css).toContain('text-transform: uppercase')
  })

  it('carries the credit and the language button, which are the two things it shares', () => {
    // Both have a "before a career exists" arm already, because that is the one
    // most easily left out. This is a third branch of the shell and the same trap.
    render(<App />)
    expect(document.querySelector('.shell__credit')).not.toBeNull()
    expect(screen.getByRole('button', { name: `EN ${t('action.language')}` })).toBeDefined()
  })

  it('goes New career → club picker → hub', () => {
    render(<App />)
    expect(screen.queryByRole('heading', { name: t('setup.heading') })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('action.newCareer') }))
    // A career is in memory, so starting another asks first.
    confirm()
    expect(screen.getByRole('heading', { name: t('setup.heading') })).toBeDefined()

    fireEvent.click(
      screen.getAllByRole('button', { name: t('setup.takeCharge') })[0] as HTMLElement,
    )
    confirm()
    expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
    expect(cover()).toBeNull()
  })

  it('goes Continue → straight back into the career that was already there', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: t('landing.continue') }))
    expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
    expect(useGame.getState().game.managedClubId).toBe(MID)
  })

  it('offers no Continue when there is no career to continue', () => {
    // The other arm matters as much: a button that is always there would satisfy
    // the test above while telling a first-time visitor to resume nothing.
    act(() => {
      useGame.getState().restart()
    })
    atDoor()
    render(<App />)
    expect(screen.queryByRole('button', { name: t('landing.continue') })).toBeNull()
    expect(screen.getByRole('button', { name: t('action.newCareer') })).toBeDefined()
  })

  it('offers no Continue once the board has sacked you', () => {
    // Without this gate Continue leads to a hub whose only button is a new career
    // — a dead end reached through the one door that promised otherwise.
    act(() => {
      const state = useGame.getState()
      useGame.setState({ game: { ...state.game, board: { ...state.game.board, sacked: true } } })
    })
    render(<App />)
    expect(screen.queryByRole('button', { name: t('landing.continue') })).toBeNull()
  })

  it('says so when storage could not be read, rather than looking like a lost career', () => {
    act(() => {
      useGame.setState({ storageBlocked: true })
    })
    render(<App />)
    expect(screen.getByRole('alert').textContent).toContain(t('setup.storageBlocked').slice(0, 24))
  })

  it('says nothing about storage when storage is fine', () => {
    // Guard on the guard: a notice that always showed would satisfy the case above
    // and tell every new player their career had failed to load.
    render(<App />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('goes Load game → the save picker → back into that save', async () => {
    render(<App />)
    // Bank a career under a name first, from inside the game.
    fireEvent.click(screen.getByRole('button', { name: t('landing.continue') }))
    advance(6)
    const dayOne = useGame.getState().game.season.currentDate
    fireEvent.click(screen.getByRole('button', { name: t('action.saves') }))
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('textbox'), {
      target: { value: 'Front door' },
    })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.write') }),
    )
    await settled()
    // `action.close` is the list view's; `action.cancel` belongs to the confirm
    // that replaces the body, and a fresh name raises no confirm to cancel.
    fireEvent.click(screen.getByRole('button', { name: t('action.close') }))

    // Move the clock on, quit to the door, and come back through Load game.
    advance(10)
    expect(useGame.getState().game.season.currentDate).toBeGreaterThan(dayOne)
    act(() => {
      useGame.getState().quitToLanding()
    })

    fireEvent.click(screen.getByRole('button', { name: t('landing.load') }))
    const dialog = screen.getByRole('dialog')
    await settled()
    fireEvent.click(
      within(dialog).getAllByRole('button', { name: t('saves.load') })[0] as HTMLElement,
    )
    // The confirm replaces the body rather than stacking a second overlay.
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('saves.load') }),
    )

    await waitFor(() => {
      expect(useGame.getState().entry).toBe('app')
    })
    expect(useGame.getState().game.season.currentDate).toBe(dayOne)
    expect(cover()).toBeNull()
  })
})

describe('leaving a career', () => {
  it('comes back here without throwing the career away', () => {
    // `quitToLanding` must not be `restart()`. Doing that would clear `needsSetup`
    // and the feed, so Continue would vanish for the career you had open a second
    // ago — and if you did get back in, the news log would be empty.
    useGame.setState({ entry: 'app' })
    render(<App />)
    advance(8)
    const day = useGame.getState().game.season.currentDate
    const feed = useGame.getState().feed.length
    expect(feed).toBeGreaterThan(0)

    act(() => {
      useGame.getState().quitToLanding()
    })
    expect(cover()).not.toBeNull()
    expect(useGame.getState().needsSetup).toBe(false)
    expect(useGame.getState().feed).toHaveLength(feed)

    fireEvent.click(screen.getByRole('button', { name: t('landing.continue') }))
    expect(useGame.getState().game.season.currentDate).toBe(day)
    expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
  })
})
