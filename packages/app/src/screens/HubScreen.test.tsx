import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { nextFixtureFor } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { advance, advanceUntil, back, openScreen } from '../testing.ts'
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

const game = () => useGame.getState().game
const quadrant = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('section') as HTMLElement

describe('the hub', () => {
  it('is where the app opens', () => {
    render(<App />)
    for (const { title } of QUADRANTS) {
      expect(screen.getByRole('heading', { name: title })).toBeDefined()
    }
  })

  it('navigates from a live tile', () => {
    render(<App />)
    fireEvent.click(within(quadrant('Mercado')).getByRole('button', { name: 'Fichar' }))
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })

  it('shows what is not built yet, disabled and dated', () => {
    // An empty quadrant reads as broken; a labelled one reads as "not yet" and
    // doubles as a roadmap you can see.
    render(<App />)
    const caja = within(quadrant('Finanzas')).getByRole('button', { name: /Caja/ })

    expect(caja.hasAttribute('disabled')).toBe(true)
    expect(caja.getAttribute('title')).toMatch(/M5/)
  })

  it('promises nothing for what has no milestone', () => {
    render(<App />)
    const calendario = within(quadrant('Seguimiento')).getByRole('button', { name: /Calendario/ })
    expect(calendario.hasAttribute('disabled')).toBe(true)
    expect(calendario.getAttribute('title')).toBe('Not built yet')
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
    expect(screen.getByRole('button', { name: /^Play match/ })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Advance day' })).toBeNull()
  })

  it('plays only when you press play', () => {
    render(<App />)
    const played = () => game().season.fixtures.filter((f) => f.result !== null).length
    expect(played()).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /^Play match/ }))
    expect(played()).toBe(10)
  })

  it('runs the clock to matchday and stops on it, not past it', () => {
    render(<App />)
    // Clear the opening fixture so there is a gap to run through.
    advance()

    const target = nextFixtureFor(game().season.fixtures, MID)
    if (target === null) throw new Error('no fixture')
    expect(game().season.currentDate).toBeLessThan(target.date)

    fireEvent.click(screen.getByRole('button', { name: 'To matchday' }))

    expect(game().season.currentDate).toBe(target.date)
    // Stopped *on* it: the fixture is still unplayed and the button now offers it.
    expect(game().season.fixtures.find((f) => f.id === target.id)?.result).toBeNull()
    expect(screen.getByRole('button', { name: /^Play match/ })).toBeDefined()
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
    expect(screen.getByText('Nothing has happened yet.')).toBeDefined()
  })

  it('reports your own result in words', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Play match/ }))
    expect(screen.getAllByText(/(Beat|Lost to|Drew with)/).length).toBeGreaterThan(0)
  })

  it('reports a transfer you would otherwise have missed', () => {
    render(<App />)
    openScreen('Fichar')

    // Bid at the asking price, then wait somewhere else — which is exactly the
    // situation where an answer used to arrive silently.
    const row = document.querySelector('.market-screen__main tbody tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    back()
    advanceUntil(() => screen.queryAllByText(/Fee agreed|was rejected|Counter-offer/).length > 0, 8)

    expect(screen.getAllByText(/Fee agreed|was rejected|Counter-offer/).length).toBeGreaterThan(0)
  })

  it('badges what happens away from the hub, and clears when you look', () => {
    // The badge's job narrowed when the day controls moved to the hub: advancing
    // now always happens with the news panel in view, which clears it on sight.
    // What is left is everything that fires *off* the hub — a bid, an offer, a
    // listing — and that is exactly what the bell is for.
    render(<App />)
    openScreen('Fichar')

    const row = document.querySelector('.market-screen__main tbody tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    expect(useGame.getState().unread).toBeGreaterThan(0)
    // The bell lives in the bar, so it is reachable without going home first.
    fireEvent.click(screen.getByRole('button', { name: /^Noticias/ }))
    expect(useGame.getState().unread).toBe(0)
  })
})
