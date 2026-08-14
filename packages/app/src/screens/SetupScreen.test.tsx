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

describe('New career', () => {
  it('returns to the picker from an in-progress season', () => {
    useGame.getState().newGame(DEFAULT_CLUBS[0]?.id)
    render(<App />)
    expect(screen.queryByRole('heading', { name: t('setup.heading') })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('action.newCareer') }))
    expect(screen.getByRole('heading', { name: t('setup.heading') })).toBeDefined()
  })
})
