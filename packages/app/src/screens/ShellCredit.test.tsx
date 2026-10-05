import { beforeEach, describe, expect, it } from 'vitest'
import { render, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { back, openScreen } from '../testing.ts'
import { TABS } from '../shell/tabs.ts'

/**
 * The credit that says this page belongs with the others.
 *
 * Two things here are worth more than they look. The shell has **two branches** —
 * the club picker replaces the whole frame — so "it renders" has to be asked
 * twice; that is the shape that caught the transfer window announcing January
 * every year and never a summer. And the space between the words and the link is
 * a bare `{' '}` in JSX, which is the same run-together hazard that shipped
 * `CanteraM7`, `20Relegated` and `Temporada 1En joc`.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t } = translatorFor('en')
const credit = () => document.querySelector('.shell__credit') as HTMLElement | null

/** Every screen a place holds, by its dictionary key. */
const TILES = TABS.flatMap((place) => place.screens)
  .filter((s) => s !== 'hub')
  .map((s) => `nav.${s}`)

beforeEach(() => {
  useGame.getState().newGame(MID)
})

describe('the pearpages credit', () => {
  it('is there before a career exists', () => {
    // The club picker is its own branch of the shell and carries no bottom bar,
    // so it is the arm most easily left out.
    useGame.getState().restart()
    render(<App />)
    expect(credit()).not.toBeNull()
  })

  it('is there on every screen of a career', () => {
    render(<App />)
    expect(credit()).not.toBeNull()

    for (const key of TILES) {
      openScreen(key)
      expect(credit(), key).not.toBeNull()
      // Through the button rather than the store: a bare `go('hub')` outside
      // `act` leaves the render stale and the next tile is not there to click.
      back()
    }
  })

  it('reads as one sentence, with the space between the words and the name', () => {
    // `{t('shell.madeBy')}{' '}<a>` — drop that `{' '}` and this reads
    // "Made bypearpages", which is what assistive technology announces and what
    // three earlier defects in this project looked like.
    //
    // The build hash is separated by a real ` · ` text node for exactly the same
    // reason: a CSS gap spaces it on screen and contributes nothing here, which
    // would give `pearpages7f1e3eb`. Matched loosely because the hash changes
    // every commit and is absent under Vitest, where the fallback fires.
    render(<App />)
    expect(credit()?.textContent?.trim()).toMatch(
      new RegExp(`^${t('shell.madeBy')} pearpages · (dev|[0-9a-f]{7,})$`),
    )
  })

  it('says which build this is, in a form you can read back over the phone', () => {
    // `define` substitutes the real hash at build time and leaves the key absent
    // under Vitest, so this asserts the shape rather than a value that changes
    // every commit — and that the fallback is a word rather than `undefined`.
    render(<App />)
    const version = credit()?.querySelector('.shell__credit-version')
    expect(version?.textContent).toMatch(/^(dev|[0-9a-f]{7,})$/)
    expect(version?.getAttribute('title')).toBe(t('shell.build'))
  })

  it('sends you to pearpages.com, and the mark contributes nothing to the name', () => {
    render(<App />)
    const box = credit()
    if (box === null) throw new Error('no credit')

    // Exactly `pearpages` — not the whole sentence. The words are a sibling of
    // the anchor rather than inside it, and the mark is decorative; both of
    // those are what keep this name clean.
    const link = within(box).getByRole('link', { name: 'pearpages' })
    expect(link.getAttribute('href')).toBe('https://pearpages.com')
    expect(link.getAttribute('target')).toBe('_blank')
    // `noopener` is the one that matters — a `target="_blank"` without it hands
    // the opened page a handle back to this one.
    expect(link.getAttribute('rel')).toContain('noopener')

    const mark = box.querySelector('img')
    expect(mark?.getAttribute('alt')).toBe('')
  })
})
