import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { computeTable } from '@fm/domain'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advance, openScreen } from '../testing.ts'

/**
 * The results grid and the palmarés.
 *
 * Everything here drives the real store and the real reducer through the hub, the
 * way a player reaches the screen — there is no router, so `openScreen` is the
 * only door.
 */

const { t, season } = translatorFor('en')

beforeEach(() => {
  useGame.getState().newGame()
})

/**
 * Opens the screen, which lands on the **matchday** tab.
 *
 * That default is deliberate and is what most of the grid tests below have to step
 * past: the cross-table is the season-shaped view and the matchday list is the one
 * that answers "what happened", so the matchday list is the one that opens.
 */
const openResults = () => {
  render(<App />)
  openScreen('nav.results')
}

/** …and then onto the cross-table, for the tests that are about the grid. */
const openGrid = () => {
  openResults()
  fireEvent.click(screen.getByRole('button', { name: t('results.tab.grid') }))
}

/**
 * Plays `days` first, then opens the screen.
 *
 * The clock has to move **before** the screen opens: on a day your fixture is due,
 * the footer's button off the hub navigates to the hub rather than kicking off, so
 * `advance()` from here would not resolve. `TableScreen.test.tsx` does the same.
 */
const openPlayedResults = (days = 1) => {
  render(<App />)
  advance(days)
  openScreen('nav.results')
}

/** The same, continuing onto the grid. */
const openPlayedGrid = (days = 1) => {
  openPlayedResults(days)
  fireEvent.click(screen.getByRole('button', { name: t('results.tab.grid') }))
}

/** The grid, as a map from `HOME|AWAY` club name to the rendered cell text. */
function cells(): Map<string, string> {
  const found = new Map<string, string>()
  const rows = document.querySelectorAll('.results-grid__row')
  // The column header's own `textContent` is the badge's three-letter code *and*
  // the club name run together — `BENBenicalap` — because `ClubBadge` draws the
  // code as SVG `<text>`. Read the hidden name span, which is what a screen reader
  // gets and the only part that is the club's name.
  const heads = [...document.querySelectorAll('.results-grid__head')].map(
    (th) => th.querySelector('.visually-hidden')?.textContent?.trim() ?? '',
  )
  for (const row of rows) {
    const home = row.querySelector('.results-grid__club')?.textContent?.trim() ?? ''
    const played = [...row.querySelectorAll('.results-grid__cell, .results-grid__self')]
    played.forEach((cell, index) => {
      const away = heads[index] ?? ''
      // The visually-hidden sentence is in here too; take the aria-hidden score.
      const score = cell.querySelector('[aria-hidden="true"]')?.textContent?.trim() ?? ''
      if (score !== '') found.set(`${home}|${away}`, score)
    })
  }
  return found
}

const managed = () => {
  const { game } = useGame.getState()
  return { game, clubId: game.managedClubId }
}

/**
 * Plays a whole season and rolls into the next, so there is one archived year.
 *
 * Through the store, before anything is rendered. Clicking "advance" three
 * hundred times with the app mounted re-rendered a screen every day: 3s here and
 * past the 15s timeout on CI under load. These tests are about the archive the
 * season leaves, not about the button that ran the clock.
 */
function playASeason() {
  const played = () => useGame.getState().game.season.fixtures.every((f) => f.result !== null)
  for (let day = 0; day < 400 && !played(); day++) {
    useGame.getState().dispatch({ type: 'AdvanceDay' })
  }
  useGame.getState().startNewSeason()
}

describe('the tile no longer lands on the classification', () => {
  it('opens a screen of its own', () => {
    openGrid()
    const stage = document.querySelector('.shell__stage') as HTMLElement

    expect(document.querySelector('.results-grid')).not.toBeNull()
    // The classification's own heading is the competition name; this is not it.
    expect(within(stage).queryByRole('heading', { name: /Primera División/i })).toBeNull()
  })
})

/*
 * The tab that exists because the cross-table could not answer the question.
 *
 * Reported after one match: the result was nowhere to be found. It was in the grid
 * — ten scores among 390 blank cells — which is the grid being the wrong instrument
 * for one matchday rather than the grid being wrong.
 */
describe('the matchday tab', () => {
  /**
   * Each row as **only what is on the screen** — home name, visible score, away
   * name.
   *
   * Reading `textContent` here is a trap, and it cost a test that proved nothing:
   * every row also carries the whole result as a `visually-hidden` sentence, so
   * `"Madrid MAD 0–7 Madrid 7–0 Málaga, matchday 1 MAL Málaga"` contains the
   * *correct* score even when the rendered one is reversed. A mutation flipping
   * the visible score passed cleanly against the hidden copy.
   */
  const rows = () =>
    [...document.querySelectorAll('.round-list__item')].map((li) => {
      const clubs = [...li.querySelectorAll('.round-list__club')].map(
        (el) => el.textContent?.trim() ?? '',
      )
      return {
        home: clubs[0] ?? '',
        away: clubs[1] ?? '',
        score:
          li.querySelector('.round-list__score [aria-hidden="true"]')?.textContent?.trim() ?? '',
      }
    })

  it('is the tab the screen opens on', () => {
    openResults()

    expect(document.querySelector('.round-list')).not.toBeNull()
    expect(document.querySelector('.results-grid')).toBeNull()
  })

  it('shows all ten of the round’s fixtures', () => {
    openResults()
    expect(document.querySelectorAll('.round-list__item')).toHaveLength(10)
  })

  it('shows the score of a match that has been played', () => {
    // The whole complaint, as a test: play round one, open the screen, see it.
    openPlayedResults()

    const { game } = managed()
    const mine = game.season.fixtures.find(
      (f) =>
        f.result !== null && (f.homeId === game.managedClubId || f.awayId === game.managedClubId),
    )
    if (mine?.result == null) throw new Error('your match was not played')

    const yours = document.querySelector('.round-list__item.is-you')
    expect(yours).not.toBeNull()
    // The *visible* score, not the row's text — that carries the hidden sentence too.
    expect(yours?.querySelector('.round-list__score [aria-hidden="true"]')?.textContent).toBe(
      `${String(mine.result.home)}–${String(mine.result.away)}`,
    )
  })

  it('lands on the latest round with a result rather than on round one', () => {
    openPlayedResults(30)

    const { game } = managed()
    const latest = Math.max(
      ...game.season.fixtures.filter((f) => f.result !== null).map((f) => f.round),
    )
    expect(latest).toBeGreaterThan(1)
    expect(
      screen.getByRole('heading', { name: t('results.roundLabel', { round: latest }) }),
    ).toBeDefined()
  })

  it('pages back and forward, and stops at both ends', () => {
    openResults()
    const back = () => screen.getByRole('button', { name: t('results.prevRound') })
    const on = () => screen.getByRole('button', { name: t('results.nextRound') })

    // Nothing played, so it opens on round one — where back is the end of the road.
    expect(
      screen.getByRole('heading', { name: t('results.roundLabel', { round: 1 }) }),
    ).toBeDefined()
    expect(back().hasAttribute('disabled')).toBe(true)

    fireEvent.click(on())
    expect(
      screen.getByRole('heading', { name: t('results.roundLabel', { round: 2 }) }),
    ).toBeDefined()
    expect(back().hasAttribute('disabled')).toBe(false)

    fireEvent.click(back())
    expect(
      screen.getByRole('heading', { name: t('results.roundLabel', { round: 1 }) }),
    ).toBeDefined()
  })

  it('stops at the last round too', () => {
    // The other end, and it needs its own test: asserting only the near bound let
    // an unbounded forward button through the whole mutation sweep.
    openResults()
    const on = () => screen.getByRole('button', { name: t('results.nextRound') })
    const last = Math.max(...useGame.getState().game.season.fixtures.map((f) => f.round))

    for (let round = 1; round < last; round++) {
      expect(on().hasAttribute('disabled'), `stuck at ${String(round)}`).toBe(false)
      fireEvent.click(on())
    }

    expect(
      screen.getByRole('heading', { name: t('results.roundLabel', { round: last }) }),
    ).toBeDefined()
    expect(on().hasAttribute('disabled')).toBe(true)
  })

  it('reads home on the left and away on the right, never flipped', () => {
    // The same hazard the grid's axes have: swap the two sides and every line is
    // reversed, plausibly, with nothing contradicting it.
    openPlayedResults()

    const { game } = managed()
    const names = new Map(game.clubs.map((c) => [c.id, c.name]))
    const decisive = game.season.fixtures.find(
      (f) => f.round === 1 && f.result !== null && f.result.home !== f.result.away,
    )
    if (decisive?.result == null) throw new Error('no decisive fixture in round one')

    const row = rows().find((r) => r.home === names.get(decisive.homeId))
    expect(row, 'no row led by the home club').toBeDefined()
    expect(row?.away).toBe(names.get(decisive.awayId))
    expect(row?.score).toBe(`${String(decisive.result.home)}–${String(decisive.result.away)}`)
  })

  it('shows a dash for a fixture not yet played', () => {
    openResults()
    const scores = [...document.querySelectorAll('.round-list__score')]

    expect(scores).toHaveLength(10)
    expect(scores.every((s) => s.classList.contains('is-unplayed'))).toBe(true)
    expect(scores[0]?.textContent).toContain('—')
  })
})

describe('the cross-table', () => {
  it('lists every club down the side and along the top', () => {
    openGrid()

    expect(document.querySelectorAll('.results-grid__row')).toHaveLength(20)
    expect(document.querySelectorAll('.results-grid__head')).toHaveLength(20)
  })

  it('blocks out the diagonal — a club does not play itself', () => {
    openGrid()

    expect(document.querySelectorAll('.results-grid__self')).toHaveLength(20)
  })

  it('puts each score in the cell for that home club against that away club', () => {
    // Round one is dated on the season start, so one press plays it.
    openPlayedGrid()

    const { game } = managed()
    const names = new Map(game.clubs.map((c) => [c.id, c.name]))
    const played = game.season.fixtures.filter((f) => f.result !== null)
    expect(played.length).toBeGreaterThan(0)

    const rendered = cells()
    for (const fixture of played) {
      const key = `${names.get(fixture.homeId)}|${names.get(fixture.awayId)}`
      expect(rendered.get(key), `no cell for ${key}`).toBe(
        `${fixture.result?.home}–${fixture.result?.away}`,
      )
    }
  })

  it('reads home–away, not away–home', () => {
    // The one thing here that could be wrong while looking entirely plausible:
    // transpose the axes and every score is reversed, and nothing contradicts it.
    // So this asserts a *decisive* fixture appears one way round and not the other.
    openPlayedGrid()

    const { game } = managed()
    const names = new Map(game.clubs.map((c) => [c.id, c.name]))
    const decisive = game.season.fixtures.find(
      (f) => f.result !== null && f.result.home !== f.result.away,
    )
    expect(decisive).toBeDefined()
    if (decisive?.result == null) return

    const rendered = cells()
    const forward = `${names.get(decisive.homeId)}|${names.get(decisive.awayId)}`
    const reversed = `${names.get(decisive.awayId)}|${names.get(decisive.homeId)}`
    const score = `${decisive.result.home}–${decisive.result.away}`

    expect(rendered.get(forward)).toBe(score)
    // The reverse fixture exists in the schedule but is played 19 rounds later, so
    // its cell must be empty rather than carrying this scoreline flipped.
    expect(rendered.get(reversed)).not.toBe(score)
  })

  it('orders both axes by the classification, not alphabetically', () => {
    openPlayedGrid(20)

    const { game } = managed()
    const table = computeTable(game.competition.clubIds, game.season.fixtures)
    const names = new Map(game.clubs.map((c) => [c.id, c.name]))

    const sideOrder = [...document.querySelectorAll('.results-grid__club')].map(
      (el) => el.textContent?.trim() ?? '',
    )
    expect(sideOrder).toEqual(table.map((row) => names.get(row.clubId)))
    // Guard on the guard: if the league happened to be in alphabetical order this
    // would pass while proving nothing.
    expect(sideOrder).not.toEqual([...sideOrder].sort())
  })

  it('marks your own row and column', () => {
    openGrid()
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    const row = document.querySelector('.results-grid__row.is-you')
    expect(row?.querySelector('.results-grid__club')?.textContent).toBe(club?.name)
    expect(document.querySelectorAll('.results-grid__head.is-you')).toHaveLength(1)
  })

  it('says what a cell means in words, for a reader who cannot see colour', () => {
    // Pointed at the grid deliberately. The matchday list renders the same
    // sentence, so without the tab step this would pass on either view and stop
    // saying anything about the cells.
    openPlayedGrid()

    const { game } = managed()
    const names = new Map(game.clubs.map((c) => [c.id, c.name]))
    const fixture = game.season.fixtures.find((f) => f.result !== null)
    if (fixture?.result == null) throw new Error('nothing played')

    const sentence = t('results.cell', {
      home: names.get(fixture.homeId) ?? '',
      away: names.get(fixture.awayId) ?? '',
      ours: fixture.result.home,
      theirs: fixture.result.away,
      round: fixture.round,
    })
    expect(screen.getAllByText(sentence).length).toBeGreaterThan(0)
  })
})

describe('the palmarés', () => {
  const openPalmares = () => {
    fireEvent.click(screen.getByRole('button', { name: t('results.tab.palmares') }))
  }

  it('says the record starts now rather than showing a blank panel', () => {
    openResults()
    openPalmares()

    expect(screen.getByText(t('palmares.empty'))).toBeDefined()
    expect(screen.getByText(t('palmares.noChampions'))).toBeDefined()
  })

  it('shows a trophy for a competition nobody has won yet', () => {
    // Dimmed rather than hidden, so the shape of what is winnable is visible from
    // day one — the same idea as the hub showing its unbuilt tiles.
    openResults()

    const trophy = document.querySelector('.trophy')
    expect(trophy?.classList.contains('is-empty')).toBe(true)
    expect(screen.getByText(t('palmares.neverWon'))).toBeDefined()
    // Decoration: the competition's name is carried as real text beside it.
    expect(trophy?.getAttribute('aria-hidden')).toBe('true')
  })

  it('records the champion once a season has been played out', () => {
    playASeason()
    render(<App />)
    openScreen('nav.results')
    openPalmares()

    const { game } = useGame.getState()
    expect(game.history).toHaveLength(1)
    const archived = game.history[0]
    if (archived === undefined) throw new Error('nothing archived')

    const champion = computeTable(archived.clubIds, archived.fixtures)[0]?.clubId
    const name = game.clubs.find((c) => c.id === champion)?.name ?? ''

    // Named in the season-by-season table and in the roll of honour.
    expect(screen.queryByText(t('palmares.empty'))).toBeNull()
    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    expect(screen.getAllByText(season(archived.startYear)).length).toBeGreaterThan(0)
  })
})

describe('what only looking at it caught', () => {
  const openPalmares = () => {
    fireEvent.click(screen.getByRole('button', { name: t('results.tab.palmares') }))
  }

  it('paints the finish band with a swatch, not with a bare class', () => {
    // `is-champion` and friends only paint under `.data-table__band` and
    // `.swatch` in `chrome.css`, so the class on a `.data-table__num` was
    // silently inert — measured in the browser at a transparent background with
    // the muted ink. A class that looks right and does nothing.
    playASeason()
    render(<App />)
    openScreen('nav.results')
    openPalmares()

    const row = document.querySelector('.data-table__row')
    const swatch = row?.querySelector('.results-screen__finish .swatch')
    expect(swatch, 'no band swatch on the finish cell').not.toBeNull()
    // And it carries a real band, not an empty class list.
    expect(swatch?.className).toMatch(/is-(champion|ucl|uel|uecl|relegation)/)
  })

  it('keeps the season picker off the palmarés, where it would do nothing', () => {
    playASeason()
    render(<App />)
    openScreen('nav.results')

    // On the grid it is the control that chooses which season to show…
    expect(document.querySelector('.results-screen__season')).not.toBeNull()
    openPalmares()
    // …and the palmarés lists every season at once, so it has nothing to change.
    expect(document.querySelector('.results-screen__season')).toBeNull()
  })
})

describe('the season picker', () => {
  it('is not offered while there is only one season', () => {
    openResults()
    expect(document.querySelector('.results-screen__season')).toBeNull()
  })

  it('offers a finished season, and shows its results', () => {
    playASeason()
    render(<App />)
    openScreen('nav.results')
    fireEvent.click(screen.getByRole('button', { name: t('results.tab.grid') }))

    const picker = document.querySelector('.results-screen__season select') as HTMLSelectElement
    expect(picker).not.toBeNull()

    const { game } = useGame.getState()
    const archived = game.history[0]
    if (archived === undefined) throw new Error('nothing archived')

    // The live season is a fresh one, so its grid is empty…
    expect([...cells().values()].filter((v) => v.includes('–'))).toHaveLength(0)

    // …and the archived one is full.
    fireEvent.change(picker, { target: { value: String(archived.startYear) } })
    expect([...cells().values()].filter((v) => v.includes('–'))).toHaveLength(380)
  })
})
