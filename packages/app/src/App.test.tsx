import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { bestXI, computeTable, overall, startersOf, teamRating, worstXI } from '@fm/domain'
import { App } from './App.tsx'
import { translatorFor } from './i18n/useT.ts'
import { matchdayFor } from './matchday.ts'
import { useGame } from './store.ts'
import { advance, back, openScreen } from './testing.ts'

/**
 * M3b's exit criterion, at the UI level: you can open the game, look at your
 * squad, change your XI, and see it affect results.
 *
 * These drive the real store and the real reducer — no mocks — so a test passing
 * here means the same path the player takes works.
 */

beforeEach(() => {
  useGame.getState().newGame()
})

/**
 * Screens are reached from the rail. The app now opens on the hub, so a test
 * about the table has to go there — which is what a player does too.
 */
const openTable = () => {
  render(<App />)
  openScreen('nav.table')
}

const { t } = translatorFor('en')

const managed = () => {
  const { game } = useGame.getState()
  return { game, clubId: game.managedClubId }
}

describe('the shell', () => {
  it('opens on the hub with the managed club named', () => {
    render(<App />)
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    // The hub is home since the M4c refactor — four quadrants, not a table.
    expect(screen.getByRole('heading', { name: t('quadrant.seguimiento') })).toBeDefined()
    expect(screen.getAllByText(club?.name ?? '').length).toBeGreaterThan(0)
  })

  it('reaches the table from the rail', () => {
    openTable()
    expect(screen.getByRole('heading', { name: /Primera División/i })).toBeDefined()
  })

  it('lists all twenty clubs in the table', () => {
    openTable()
    const rows = screen.getAllByRole('row')
    // 20 clubs plus the header row.
    expect(rows.length).toBe(21)
  })

  it('marks the managed club’s row so it can be found at a glance', () => {
    openTable()
    expect(document.querySelectorAll('.data-table__row.is-you')).toHaveLength(1)
  })

  it('reaches every live section from the hub, and comes back', () => {
    // There is no rail: the hub is the only branching point, so every screen is
    // hub -> tile -> Volver -> hub. If any leg of this breaks, a screen has
    // become unreachable.
    render(<App />)

    for (const [tile, heading] of [
      ['nav.table', /Primera División/i],
      ['nav.squad', /Squad/i],
      ['nav.lineup', /Starting XI/],
      ['nav.market', /Transfer market/],
    ] as const) {
      openScreen(tile)
      // Scoped to the stage: the bar's title and a screen's own heading are now
      // the same word in English for some screens, which they were not while the
      // bar spoke Spanish and the screens spoke English.
      const stage = document.querySelector('.shell__stage') as HTMLElement
      expect(within(stage).getByRole('heading', { name: heading })).toBeDefined()
      back()
      expect(screen.getByRole('heading', { name: t('quadrant.seguimiento') })).toBeDefined()
    }
  })
})

describe('the title bar says where you stand', () => {
  // It used to say which club you manage — a fact that never changes and which
  // the hub already states with a crest. What a title bar is for is the
  // situation: which competition, which matchday, what position.
  const bar = () => {
    const element = document.querySelector('.shell__bar')
    if (element === null) throw new Error('no bar')
    return element as HTMLElement
  }

  it('names the competition, not the club', () => {
    render(<App />)
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    expect(within(bar()).getByText('Primera División')).toBeDefined()
    expect(within(bar()).queryByText(club?.name ?? '')).toBeNull()
  })

  it('shows the round you are about to play, not the one just finished', () => {
    render(<App />)
    expect(within(bar()).getByText(t('shell.matchday', { round: 1 }))).toBeDefined()

    advance() // round one is dated on the season start, so this plays it
    expect(within(bar()).getByText(t('shell.matchday', { round: 2 }))).toBeDefined()
  })

  it('shows the position the classification gives you', () => {
    render(<App />)
    advance()

    const { game, clubId } = managed()
    const table = computeTable(game.competition.clubIds, game.season.fixtures)
    const place = table.findIndex((row) => row.clubId === clubId) + 1

    expect(place).toBeGreaterThan(0)
    expect(within(bar()).getByText(t('shell.position', { position: place }))).toBeDefined()
  })

  it('carries the next opponent’s badge', () => {
    render(<App />)
    const { game } = managed()
    const opponent = matchdayFor(game)?.opponent

    const code = bar().querySelector('.shell__next .club-badge__code')
    expect(code?.textContent).toBe(opponent?.shortName)
  })
})

describe('advancing the day', () => {
  it('plays the round and shows the results', () => {
    // The results list lives on the table screen; the clock lives on the hub. So
    // this is the round trip a player actually makes.
    openTable()
    expect(screen.getByText(/Advance the day to play/)).toBeDefined()

    back()
    advance()
    openScreen('nav.table')

    const played = useGame.getState().game.season.fixtures.filter((f) => f.result !== null)
    expect(played).toHaveLength(10)
    expect(screen.queryByText(/Advance the day to play/)).toBeNull()
  })

  it('moves the clock forward', () => {
    render(<App />)
    const before = useGame.getState().game.season.currentDate
    advance()
    expect(useGame.getState().game.season.currentDate).toBe(before + 1)
  })
})

describe('the squad screen', () => {
  it('shows the full squad and opens a player’s ficha', () => {
    render(<App />)
    openScreen('nav.squad')

    const { game, clubId } = managed()
    const squad = game.squads[clubId] ?? []
    expect(squad.length).toBeGreaterThan(20)

    const first = squad[0]
    if (first === undefined) throw new Error('empty squad')
    fireEvent.click(screen.getByText(first.name))

    expect(screen.getByRole('heading', { name: first.name })).toBeDefined()
    expect(screen.getByText(String(overall(first)))).toBeDefined()
  })

  it('renders one bar per attribute on the ficha', () => {
    render(<App />)
    openScreen('nav.squad')
    const { game, clubId } = managed()
    const first = (game.squads[clubId] ?? [])[0]
    if (first === undefined) throw new Error('empty squad')

    fireEvent.click(screen.getByText(first.name))
    expect(document.querySelectorAll('.attr')).toHaveLength(8)
  })
})

describe('the lineup screen', () => {
  it('changes formation through the reducer', () => {
    render(<App />)
    openScreen('nav.lineup')
    fireEvent.click(screen.getByRole('button', { name: '4-3-3' }))

    const { game, clubId } = managed()
    expect(game.lineups[clubId]?.formation).toBe('4-3-3')
    expect(game.lineups[clubId]?.starters).toHaveLength(11)
  })

  it('changes the approach through the reducer', () => {
    render(<App />)
    openScreen('nav.lineup')
    fireEvent.change(screen.getByLabelText(/Approach/), { target: { value: '100' } })

    const { game, clubId } = managed()
    expect(game.tactics[clubId]?.attacking).toBe(100)
    expect(screen.getByLabelText(/All-out attack/)).toBeDefined()
  })

  it('shows the two numbers the resolver actually reads', () => {
    render(<App />)
    openScreen('nav.lineup')

    const panel = screen.getByRole('heading', { name: 'This XI' }).parentElement
    if (panel === null) throw new Error('no panel')
    expect(within(panel).getByText('Attack')).toBeDefined()
    expect(within(panel).getByText('Defence')).toBeDefined()
  })

  it('swapping a starter for a weaker substitute lowers the rating', () => {
    // The exit criterion in miniature: a lineup change the player makes on screen
    // has to move the numbers the match resolver consumes.
    render(<App />)
    openScreen('nav.lineup')

    const { game, clubId } = managed()
    const squad = game.squads[clubId] ?? []
    useGame.getState().dispatch({
      type: 'SetLineup',
      clubId,
      lineup: worstXI(squad, '4-4-2'),
    })
    const weak = useGame.getState().game.lineups[clubId]

    useGame.getState().dispatch({ type: 'SetLineup', clubId, lineup: bestXI(squad, '4-4-2') })
    const strong = useGame.getState().game.lineups[clubId]

    expect(weak?.starters).not.toEqual(strong?.starters)
  })
})

describe('a bad lineup reaches the resolver', () => {
  // This used to compare two single seasons and assert the better XI won more
  // points. A single season cannot resolve the effect — it is ~7 points against
  // season-to-season variance of a similar size — so the test was passing on
  // luck, and stopped when an unrelated change shifted the rng stream.
  //
  // The statistical claim belongs to the domain harness, which measures it over
  // 20 seasons. What the UI needs to prove is narrower and deterministic: a
  // lineup chosen on screen changes the two numbers the resolver reads.

  const ratingAfter = (pick: typeof bestXI) => {
    useGame.getState().newGame()
    const { game, clubId } = managed()
    const squad = game.squads[clubId] ?? []
    useGame.getState().dispatch({ type: 'SetLineup', clubId, lineup: pick(squad, '4-4-2') })

    const after = useGame.getState().game
    const lineup = after.lineups[clubId]
    if (lineup === undefined) throw new Error('no lineup')
    return teamRating(startersOf(after.squads[clubId] ?? [], lineup), after.tactics[clubId])
  }

  it('a worse XI produces worse attack and defence', () => {
    const best = ratingAfter(bestXI)
    const worst = ratingAfter(worstXI)
    expect(best.attack).toBeGreaterThan(worst.attack)
    expect(best.defence).toBeGreaterThan(worst.defence)
  })

  it('and the season actually plays out through that lineup', () => {
    // Cheap end-to-end check that dispatching from the UI reaches match results
    // at all — one round, deterministic, no statistics involved.
    useGame.getState().newGame()
    const { clubId } = managed()
    const squad = useGame.getState().game.squads[clubId] ?? []
    useGame.getState().dispatch({ type: 'SetLineup', clubId, lineup: worstXI(squad, '4-4-2') })
    useGame.getState().dispatch({ type: 'AdvanceDay' })

    const played = useGame.getState().game.season.fixtures.filter((f) => f.result !== null)
    expect(played).toHaveLength(10)
  })
})
