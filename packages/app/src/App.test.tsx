import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import {
  bestXI,
  transferWindowDaysLeft,
  overall,
  startersOf,
  teamRating,
  worstXI,
} from '@fm/domain'
import { App } from './App.tsx'
import { translatorFor } from './i18n/useT.ts'
import { matchdayFor } from './matchday.ts'
import { TABS } from './shell/tabs.ts'
import { useGame } from './store.ts'
import { advance, advanceUntil, back, openScreen } from './testing.ts'

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

const { t, plural } = translatorFor('en')

const managed = () => {
  const { game } = useGame.getState()
  return { game, clubId: game.managedClubId }
}

describe('the shell', () => {
  it('opens on Avui with the managed club named', () => {
    render(<App />)
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    // Avui, at every width (ADR 0022): the next match first.
    expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
    expect(screen.getByRole('heading', { name: t('hub.nextMatch') })).toBeDefined()
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

  it('reaches every screen from its place, and comes back', () => {
    // Every screen through the tabs (the rail on the desk) and its segment. If
    // any leg breaks, a screen has become unreachable.
    render(<App />)

    const legs = [
      ['nav.table', /Primera División/i],
      // The screen opens on the matchday tab, not the cross-table.
      ['nav.results', /Matchday \d+/i],
      ['nav.calendar', /Calendar ·/i],
      ['nav.squad', /Squad/i],
      ['nav.lineup', /Starting XI/],
      ['nav.market', /Transfer market/],
      ['nav.caja', /Accounts/i],
      ['nav.decisiones', /The objective/i],
      ['nav.estadio', /The ground/i],
    ] as const

    // Guard on the guard: every screen a place holds has a leg, so adding a
    // screen and forgetting its leg cannot leave the walk green.
    const reachable = TABS.flatMap((place) => place.screens)
      .filter((s) => s !== 'hub')
      .map((s) => `nav.${s}`)
    expect([...legs.map(([key]) => key)].sort()).toEqual([...reachable].sort())

    for (const [key, heading] of legs) {
      openScreen(key)
      const stage = document.querySelector('.shell__stage') as HTMLElement
      expect(within(stage).getByRole('heading', { name: heading })).toBeDefined()
      back()
      expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
    }
  })
})

describe('the title bar says where you are', () => {
  // The place, and the one deadline the game enforces. The competition and the
  // round left it, on the phone first and then everywhere (ADR 0022): the round
  // lives on the match card.
  const bar = () => {
    const element = document.querySelector('.shell-bar')
    if (element === null) throw new Error('no bar')
    return element as HTMLElement
  }

  it('names the place, not the competition or the club', () => {
    render(<App />)
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    expect(within(bar()).getByRole('heading', { name: t('tab.today') })).toBeDefined()
    expect(within(bar()).queryByText('Primera División')).toBeNull()
    expect(within(bar()).queryByText(club?.name ?? '')).toBeNull()
  })

  it('leaves the round to the match card, and it is the one about to be played', () => {
    render(<App />)
    const round = () => document.querySelector('.hub__round')?.textContent
    expect(round()).toBe(t('shell.matchday', { round: 1 }))

    advance() // round one is dated on the season start, so this plays it
    expect(round()).toBe(t('shell.matchday', { round: 2 }))
  })

  it('leaves the position, the date and the next fixture to Avui', () => {
    render(<App />)
    const opponent = matchdayFor(managed().game)?.opponent

    expect(bar().querySelector('.hub__position')).toBeNull()
    expect(within(bar()).queryByText(opponent?.name ?? 'no opponent')).toBeNull()
  })

  it('flags the transfer window, and only while it is open', () => {
    render(<App />)

    // A career opens on 15 August, inside the summer window.
    const chip = () => within(bar()).queryByRole('button', { name: /Transfer window open/ })
    expect(chip()?.textContent).toContain(plural('shell.windowOpen', 17))

    // Out the far side of it: a badge that is always there is furniture.
    advanceUntil(() => transferWindowDaysLeft(managed().game.season.currentDate) === null)
    expect(chip()).toBeNull()
  })

  // The number falling is the actual claim. Asserting one static figure would pass
  // against a badge that had the day count typed into it and never moved.
  it('counts the days left down as the clock runs', () => {
    render(<App />)
    const seen: string[] = []
    const name = () =>
      within(bar()).getByRole('button', { name: /Transfer window open/ }).textContent ?? ''

    for (let i = 0; i < 4; i++) {
      seen.push(name())
      advance()
    }

    expect(seen.map((s) => s.replace(/^.*?(Transfer)/, '$1'))).toEqual(
      [17, 16, 15, 14].map((d) => plural('shell.windowOpen', d)),
    )

    // On the last day it must read singular, not "1 days".
    advanceUntil(() => transferWindowDaysLeft(managed().game.season.currentDate) === 1)
    expect(name()).toContain(plural('shell.windowOpen', 1))
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
    // Among the card's figures: the same number can also be his age, or a bar.
    const vitals = document.querySelector('.ficha__vitals') as HTMLElement
    expect(within(vitals).getAllByText(String(overall(first))).length).toBeGreaterThan(0)
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
