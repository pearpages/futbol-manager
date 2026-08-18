import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'

const { t } = translatorFor('en')
import { ADVANCE } from '../testing.ts'

/**
 * Until M3c every career started at Almería, because `newSeason` defaulted to the
 * last-rated club. Nobody chose that, and it happened to be the club with the
 * least to play for.
 */

beforeEach(() => {
  useGame.getState().restart()
})

describe('choosing a club', () => {
  it('is what you see when there is no career', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: t('setup.heading') })).toBeDefined()
    // The shell's navigation is meaningless before a club exists.
    expect(screen.queryByRole('button', { name: ADVANCE() })).toBeNull()
  })

  it('offers every club in the division', () => {
    render(<App />)
    for (const club of DEFAULT_CLUBS) {
      expect(screen.getByText(club.name)).toBeDefined()
    }
    expect(screen.getAllByRole('button', { name: t('setup.takeCharge') })).toHaveLength(20)
  })

  it('says what you are taking on, so the choice is informed', () => {
    render(<App />)
    const strongest = screen.getByText(DEFAULT_CLUBS[0]?.name ?? '').closest('tr')
    const weakest = screen.getByText(DEFAULT_CLUBS.at(-1)?.name ?? '').closest('tr')
    if (strongest === null || weakest === null) throw new Error('no rows')

    expect(within(strongest).getByText('Contender')).toBeDefined()
    expect(within(weakest).getByText('Relegation favourite')).toBeDefined()
  })

  it('starts the career at the club you picked', () => {
    render(<App />)
    const madrid = DEFAULT_CLUBS[0]
    if (madrid === undefined) throw new Error('no clubs')

    const row = screen.getByText(madrid.name).closest('tr')
    if (row === null) throw new Error('no row')
    fireEvent.click(within(row).getByRole('button', { name: t('setup.takeCharge') }))

    expect(useGame.getState().game.managedClubId).toBe(madrid.id)
    expect(useGame.getState().needsSetup).toBe(false)
    expect(screen.getByRole('button', { name: ADVANCE() })).toBeDefined()
  })

  it('no longer forces the weakest club on you', () => {
    render(<App />)
    const mid = DEFAULT_CLUBS[9]
    if (mid === undefined) throw new Error('no clubs')

    const row = screen.getByText(mid.name).closest('tr')
    if (row === null) throw new Error('no row')
    fireEvent.click(within(row).getByRole('button', { name: t('setup.takeCharge') }))

    expect(useGame.getState().game.managedClubId).not.toBe(DEFAULT_CLUBS.at(-1)?.id)
  })

  it('gives the whole squad to whichever club you chose', () => {
    render(<App />)
    const club = DEFAULT_CLUBS[3]
    if (club === undefined) throw new Error('no clubs')

    const row = screen.getByText(club.name).closest('tr')
    if (row === null) throw new Error('no row')
    fireEvent.click(within(row).getByRole('button', { name: t('setup.takeCharge') }))

    const { game } = useGame.getState()
    expect(game.squads[game.managedClubId]?.length).toBeGreaterThan(20)
    expect(game.lineups[game.managedClubId]?.starters).toHaveLength(11)
  })
})

/**
 * Leaving a career now lands on the front page rather than here, so the walk from
 * a season to the picker is `LandingScreen.test.tsx`'s — it is two presses in two
 * different places and belongs where the door is. What is still this file's is
 * that the question gets asked at all, and that declining it changes nothing.
 */
describe('Leaving a career', () => {
  it('asks first, because there is no undo behind it', () => {
    useGame.getState().newGame(DEFAULT_CLUBS[0]?.id)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: t('action.quit') }))
    expect(screen.getByText(t('hub.confirmQuit'))).toBeDefined()
    // Still in the career at this point — the question has been asked, not answered.
    expect(screen.queryByRole('heading', { name: t('setup.heading') })).toBeNull()
  })

  it('leaves the career alone when the question is declined', () => {
    useGame.getState().newGame(DEFAULT_CLUBS[0]?.id)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: t('action.quit') }))
    fireEvent.click(screen.getByRole('button', { name: t('action.cancel') }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('heading', { name: t('setup.heading') })).toBeNull()
    expect(useGame.getState().needsSetup).toBe(false)
  })
})

describe('sorting the club picker', () => {
  /** Club names in rendered order, and the array the screen sorts from. */
  const rendered = () =>
    [...document.querySelectorAll('.setup__panel tbody tr')].map(
      (tr) => tr.querySelector('.club-cell')?.lastChild?.textContent ?? '',
    )

  const header = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) })

  it('lines the division up by attack', () => {
    render(<App />)
    fireEvent.click(header(t('setup.column.attack')))

    const attackOf = new Map(DEFAULT_CLUBS.map((c) => [c.name, c.attack]))
    const shown = rendered().map((name) => attackOf.get(name) ?? 0)
    expect(shown).toEqual([...shown].sort((a, b) => b - a))
  })

  it('never reorders DEFAULT_CLUBS itself', () => {
    // The picker renders a module constant shared with the whole app. Sorted in
    // place, one click would reorder the league for every screen and every new
    // career — which is why `sortedBy` copies unconditionally.
    const before = DEFAULT_CLUBS.map((c) => c.id)
    render(<App />)
    fireEvent.click(header(t('setup.column.club')))
    fireEvent.click(header(t('setup.column.defence')))

    expect(DEFAULT_CLUBS.map((c) => c.id)).toEqual(before)
  })

  it('still takes you to the club on the row you press, once sorted', () => {
    // Rows are looked up by name everywhere else in this file; this is the one that
    // would catch a sort that reordered the labels but not the click handlers.
    render(<App />)
    fireEvent.click(header(t('setup.column.club')))

    const first = rendered()[0] ?? ''
    const row = screen.getByText(first).closest('tr')
    if (row === null) throw new Error('no row')
    fireEvent.click(within(row).getByRole('button', { name: t('setup.takeCharge') }))

    const chosen = DEFAULT_CLUBS.find((c) => c.name === first)
    expect(useGame.getState().game.managedClubId).toBe(chosen?.id)
  })
})

describe('when storage could not be read', () => {
  it('says why, rather than looking like the career is gone', () => {
    // Another tab holding the database at an older version is the one failure
    // that lands a player with a saved career on the club picker. Silence there
    // reads as "your career has been lost", which is both alarming and false.
    useGame.setState({ needsSetup: true, storageBlocked: true })
    render(<App />)

    expect(screen.getByRole('alert').textContent).toBe(t('setup.storageBlocked'))
    expect(screen.queryByText(t('setup.note'))).toBeNull()
  })

  it('says nothing of the sort on an ordinary first visit', () => {
    // The guard on the guard: a notice that always showed would satisfy the test
    // above while telling every new player their career had failed to load.
    useGame.setState({ needsSetup: true, storageBlocked: false })
    render(<App />)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(t('setup.note'))).toBeDefined()
  })
})
