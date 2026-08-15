import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { computeTable, nextFixtureFor, recentResultsFor } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { bandFor } from '../bands.ts'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { advance, advanceUntil, back, openScreen } from '../testing.ts'
import { translatorFor } from '../i18n/useT.ts'
import { FORM_MATCHES } from './FormStrip.tsx'
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

describe('the form strip', () => {
  const pips = () => [...document.querySelectorAll('.form-strip__pip')]
  const outcomeOf = (pip: Element) =>
    ['win', 'draw', 'loss'].find((o) => pip.classList.contains(`is-${o}`)) ?? null

  it('always shows ten cells, grey before a ball is kicked', () => {
    render(<App />)

    expect(pips()).toHaveLength(FORM_MATCHES)
    expect(pips().map(outcomeOf)).toEqual(Array.from({ length: FORM_MATCHES }, () => null))
    // Colour is never the only signal.
    expect(pips()[0]?.textContent).toBe(t('form.notPlayed'))
  })

  it('fills from the right, so the newest result is the last square', () => {
    render(<App />)
    advance() // round one is dated on the season start, so this plays it

    const results = recentResultsFor(game().season.fixtures, MID, FORM_MATCHES)
    expect(results).toHaveLength(1)

    expect(pips()).toHaveLength(FORM_MATCHES)
    expect(
      pips()
        .slice(0, FORM_MATCHES - 1)
        .map(outcomeOf),
    ).toEqual(Array.from({ length: FORM_MATCHES - 1 }, () => null))
    expect(outcomeOf(pips().at(-1) as Element)).toBe(results[0]?.outcome)
  })

  /**
   * Recomputed from the fixtures rather than asserted against a fixed list: the
   * claim is that the strip agrees with what was actually played, in order.
   */
  it('agrees with the fixtures once ten are in the books', () => {
    render(<App />)
    advanceUntil(
      () => recentResultsFor(game().season.fixtures, MID, FORM_MATCHES).length === FORM_MATCHES,
      // A round is a week, so filling ten squares takes ~70 ticks. Sized well clear
      // of that: too low fails as "still not done after N presses", which reads as a
      // broken strip rather than a short guard.
      120,
    )

    const results = recentResultsFor(game().season.fixtures, MID, FORM_MATCHES)
    expect(pips().map(outcomeOf)).toEqual(results.map((r) => r.outcome))
    // Every square now carries a real sentence naming the opponent.
    const opponent = game().clubs.find((c) => c.id === results.at(-1)?.opponentId)?.name
    expect(pips().at(-1)?.textContent).toContain(opponent)
  })

  it('survives a reload, because it is built from fixtures and not the feed', () => {
    render(<App />)
    advanceUntil(() => recentResultsFor(game().season.fixtures, MID, FORM_MATCHES).length >= 2, 30)
    const before = pips().map(outcomeOf)

    // The feed is session-only and is cleared on load; the fixtures are not.
    useGame.setState({ feed: [] })
    expect(pips().map(outcomeOf)).toEqual(before)
    expect(before.filter(Boolean).length).toBeGreaterThanOrEqual(2)
  })
})

describe('the position stat', () => {
  const stat = () => document.querySelector('.hub__position')
  const placeOf = (clubId: typeof MID) => {
    const table = computeTable(game().competition.clubIds, game().season.fixtures)
    return { position: table.findIndex((r) => r.clubId === clubId) + 1, total: table.length }
  }

  it('shows the place the classification gives you', () => {
    render(<App />)
    advance()

    const { position } = placeOf(MID)
    expect(position).toBeGreaterThan(0)
    expect(stat()?.textContent).toContain(String(position))
  })

  it('takes the band colour, and names it for anyone who cannot see colour', () => {
    // Drive to a club that is actually in a band rather than hoping the managed one
    // lands in one — a test that only passes on a lucky table proves nothing.
    render(<App />)
    advanceUntil(() => placeOf(MID).position > 0, 5)

    const { position, total } = placeOf(MID)
    const band = bandFor(position, total)
    if (band === null) {
      expect(stat()?.className).not.toMatch(/is-(champion|ucl|uel|uecl|relegation)/)
    } else {
      expect(stat()?.className).toContain(band.className)
      expect(stat()?.textContent).toContain(t(band.label))
      expect(stat()?.getAttribute('title')).toBe(t(band.label))
    }
  })

  it('leaves mid-table uncoloured, which is what mid-table means', () => {
    // The guard on the guard: a rule that painted every position would satisfy the
    // test above whenever the managed club happened to sit in a band.
    render(<App />)
    for (const position of [7, 8, 12, 17]) {
      expect(bandFor(position, 20), `position ${String(position)}`).toBeNull()
    }
    // And a banded one still resolves, so the check above is not vacuous.
    expect(bandFor(1, 20)?.className).toBe('is-champion')
    expect(bandFor(20, 20)?.className).toBe('is-relegation')
  })
})
