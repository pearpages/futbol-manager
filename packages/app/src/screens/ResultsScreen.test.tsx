import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { computeTable } from '@fm/domain'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advance, advanceUntil, openScreen } from '../testing.ts'

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

const openResults = () => {
  render(<App />)
  openScreen('nav.results')
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

/** Plays a whole season and rolls into the next, so there is one archived year. */
function playASeason() {
  advanceUntil(() => useGame.getState().game.season.fixtures.every((f) => f.result !== null), 500)
  // The season-over press is `Start <season>`, which `advance` resolves.
  advance()
}

describe('the tile no longer lands on the classification', () => {
  it('opens a screen of its own', () => {
    openResults()
    const stage = document.querySelector('.shell__stage') as HTMLElement

    expect(document.querySelector('.results-grid')).not.toBeNull()
    // The classification's own heading is the competition name; this is not it.
    expect(within(stage).queryByRole('heading', { name: /Primera División/i })).toBeNull()
  })
})

describe('the cross-table', () => {
  it('lists every club down the side and along the top', () => {
    openResults()

    expect(document.querySelectorAll('.results-grid__row')).toHaveLength(20)
    expect(document.querySelectorAll('.results-grid__head')).toHaveLength(20)
  })

  it('blocks out the diagonal — a club does not play itself', () => {
    openResults()

    expect(document.querySelectorAll('.results-grid__self')).toHaveLength(20)
  })

  it('puts each score in the cell for that home club against that away club', () => {
    // Round one is dated on the season start, so one press plays it.
    openPlayedResults()

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
    openPlayedResults()

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
    openPlayedResults(20)

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
    openResults()
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    const row = document.querySelector('.results-grid__row.is-you')
    expect(row?.querySelector('.results-grid__club')?.textContent).toBe(club?.name)
    expect(document.querySelectorAll('.results-grid__head.is-you')).toHaveLength(1)
  })

  it('says what a cell means in words, for a reader who cannot see colour', () => {
    openPlayedResults()

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
    render(<App />)
    playASeason()
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
    render(<App />)
    playASeason()
    openScreen('nav.results')
    openPalmares()

    const row = document.querySelector('.data-table__row')
    const swatch = row?.querySelector('.results-screen__finish .swatch')
    expect(swatch, 'no band swatch on the finish cell').not.toBeNull()
    // And it carries a real band, not an empty class list.
    expect(swatch?.className).toMatch(/is-(champion|ucl|uel|uecl|relegation)/)
  })

  it('keeps the season picker off the palmarés, where it would do nothing', () => {
    render(<App />)
    playASeason()
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
    render(<App />)
    playASeason()
    openScreen('nav.results')

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
