import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { nextFixtureFor } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { advance, advanceUntil, back, openScreen } from '../testing.ts'
import { translatorFor } from '../i18n/useT.ts'
import { QUADRANTS } from './HubScreen.tsx'

/**
 * The hub, the news feed and matchday — the three things a player could not see.
 *
 * All deterministic. The statistical claims still live in the domain harness.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const { t } = translatorFor('en')
const game = () => useGame.getState().game
const quadrant = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('section') as HTMLElement

describe('the hub', () => {
  it('is where the app opens', () => {
    render(<App />)
    for (const { title } of QUADRANTS) {
      expect(screen.getByRole('heading', { name: t(title) })).toBeDefined()
    }
  })

  it('navigates from a live tile', () => {
    render(<App />)
    fireEvent.click(
      within(quadrant(t('quadrant.mercado'))).getByRole('button', { name: t('nav.market') }),
    )
    expect(screen.getByRole('heading', { name: t('market.heading') })).toBeDefined()
  })

  it('shows what is not built yet, disabled and dated', () => {
    // An empty quadrant reads as broken; a labelled one reads as "not yet" and
    // doubles as a roadmap you can see.
    //
    // This used to point at Caja, which M5b built. Cantera is the remaining
    // example — and having to move it is the test doing its job: a tile going
    // live should not be able to pass silently as one that has not.
    render(<App />)
    const cantera = within(quadrant(t('quadrant.mercado'))).getByRole('button', {
      name: `${t('nav.youth')}M7`,
    })

    expect(cantera.hasAttribute('disabled')).toBe(true)
    expect(cantera.getAttribute('title')).toMatch(/M7/)
  })

  it('opens the three finance screens M5b built', () => {
    render(<App />)
    for (const tile of ['nav.caja', 'nav.decisiones', 'nav.estadio'] as const) {
      const button = within(quadrant(t('quadrant.finanzas'))).getByRole('button', { name: t(tile) })
      expect(button.hasAttribute('disabled'), tile).toBe(false)
    }
  })

  it('promises nothing for what has no milestone', () => {
    render(<App />)
    const calendar = within(quadrant(t('quadrant.seguimiento'))).getByRole('button', {
      name: t('nav.calendar'),
    })
    expect(calendar.hasAttribute('disabled')).toBe(true)
    expect(calendar.getAttribute('title')).toBe(t('hub.notBuilt'))
  })
})

describe('knowing when you play', () => {
  it('names the next opponent on the hub and in the bar', () => {
    render(<App />)
    const fixture = nextFixtureFor(game().season.fixtures, MID)
    if (fixture === null) throw new Error('no fixture')
    const opponentId = fixture.homeId === MID ? fixture.awayId : fixture.homeId
    const opponent = game().clubs.find((c) => c.id === opponentId)?.name ?? ''

    expect(screen.getAllByText(new RegExp(opponent)).length).toBeGreaterThan(0)
  })

  it('shows the opponent’s badge beside his name', () => {
    // A crest identifies a club faster than a name in a list does, and the two
    // clubs in the centre column — you and whoever is next — now read at the
    // same size.
    render(<App />)
    const fixture = nextFixtureFor(game().season.fixtures, MID)
    if (fixture === null) throw new Error('no fixture')
    const opponentId = fixture.homeId === MID ? fixture.awayId : fixture.homeId
    const opponent = game().clubs.find((c) => c.id === opponentId)

    const code = document.querySelector('.hub__opponent .club-badge__code')
    expect(code?.textContent).toBe(opponent?.shortName)
  })

  it('opens a new career with the first fixture already due', () => {
    // Round one is dated on the season start, so kicking off is the first thing
    // asked of you — and it is a distinct button, not Advance day.
    render(<App />)
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: t('hub.advanceDay') })).toBeNull()
  })

  it('plays only when you press play', () => {
    render(<App />)
    const played = () => game().season.fixtures.filter((f) => f.result !== null).length
    expect(played()).toBe(0)

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    )
    expect(played()).toBe(10)
  })

  it('runs the clock to matchday and stops on it, not past it', () => {
    render(<App />)
    // Clear the opening fixture so there is a gap to run through.
    advance()

    const target = nextFixtureFor(game().season.fixtures, MID)
    if (target === null) throw new Error('no fixture')
    expect(game().season.currentDate).toBeLessThan(target.date)

    fireEvent.click(screen.getByRole('button', { name: t('hub.toMatchday') }))

    expect(game().season.currentDate).toBe(target.date)
    // Stopped *on* it: the fixture is still unplayed and the button now offers it.
    expect(game().season.fixtures.find((f) => f.id === target.id)?.result).toBeNull()
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    ).toBeDefined()
  })
})

describe('the weak-XI warning', () => {
  it('stays quiet when the strongest XI is picked', () => {
    render(<App />)
    expect(screen.queryByText(/not your strongest/)).toBeNull()
  })

  it('speaks up when it is not', () => {
    // The case M4c created: signing a player no longer selects him, so a manager
    // can buy a keeper and play the old one with nothing to tell him.
    const state = game()
    const squad = state.squads[MID] ?? []
    const lineup = state.lineups[MID]
    if (lineup === undefined) throw new Error('no lineup')

    // Swap a starter for a reserve of the same position.
    const starters = new Set(lineup.starters)
    const out = squad.find((p) => starters.has(p.id) && p.position === 'DF')
    const bench = squad.find((p) => !starters.has(p.id) && p.position === 'DF')
    if (out === undefined || bench === undefined) throw new Error('no swap available')

    useGame.getState().dispatch({
      type: 'SetLineup',
      clubId: MID,
      lineup: { ...lineup, starters: lineup.starters.map((id) => (id === out.id ? bench.id : id)) },
    })

    render(<App />)
    expect(screen.getAllByText(/not your strongest/).length).toBeGreaterThan(0)
  })
})

describe('the news feed', () => {
  it('says nothing before anything has happened', () => {
    render(<App />)
    expect(screen.getByText(t('hub.noNews'))).toBeDefined()
  })

  it('reports your own result in words', () => {
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.playMatch', { opponent: '' }).trim()}`),
      }),
    )
    expect(screen.getAllByText(/(Beat|Lost to|Drew with)/).length).toBeGreaterThan(0)
  })

  it('reports a transfer you would otherwise have missed', () => {
    render(<App />)
    openScreen('nav.market')

    // Bid at the asking price, then wait somewhere else — which is exactly the
    // situation where an answer used to arrive silently.
    const row = document.querySelector('.market-screen__main tbody tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: t('market.bid') }))
    fireEvent.click(screen.getByRole('button', { name: t('market.makeBid') }))

    back()
    advanceUntil(() => screen.queryAllByText(/Fee agreed|was rejected|Counter-offer/).length > 0, 8)

    expect(screen.getAllByText(/Fee agreed|was rejected|Counter-offer/).length).toBeGreaterThan(0)
  })
})
