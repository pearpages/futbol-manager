import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, within } from '@testing-library/react'
import { computeTable } from '@fm/domain'
import { matchdayFor } from '../matchday.ts'
import { BANDS, bandFor } from '../bands.ts'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { translatorFor } from '../i18n/useT.ts'
import { advance, back, openScreen } from '../testing.ts'

const { t } = translatorFor('en')

/**
 * The qualification bands were previously an `if` chain, and fifth place fell
 * through every branch — it rendered with no colour and nothing explained why.
 * These walk every position instead of spot-checking, which is the difference
 * between catching that and not.
 */

const LEAGUE = 20

describe('bandFor', () => {
  it.each([
    [1, 'table.band.champion'],
    [2, 'table.band.ucl'],
    [3, 'table.band.ucl'],
    [4, 'table.band.ucl'],
    [5, 'table.band.uel'],
    [6, 'table.band.uecl'],
    [18, 'table.band.relegation'],
    [19, 'table.band.relegation'],
    [20, 'table.band.relegation'],
  ])('gives position %i the %s band', (position, label) => {
    expect(bandFor(position, LEAGUE)?.label).toBe(label)
  })

  it('leaves mid-table unbanded', () => {
    for (let position = 7; position <= 17; position++) {
      expect(bandFor(position, LEAGUE)).toBeNull()
    }
  })

  it('covers every position exactly once', () => {
    // The bug was a gap. This asserts there are none, anywhere.
    for (let position = 1; position <= LEAGUE; position++) {
      const matches = BANDS.filter((b) => bandFor(position, LEAGUE)?.className === b.className)
      expect(matches.length).toBeLessThanOrEqual(1)
    }
    const banded = Array.from({ length: LEAGUE }, (_, i) => bandFor(i + 1, LEAGUE)).filter(
      (b) => b !== null,
    )
    expect(banded).toHaveLength(9) // 1 champion + 3 UCL + 1 UEL + 1 UECL + 3 relegated
  })

  it('anchors relegation to the bottom, whatever the league size', () => {
    // Negative ranges count from the foot of the table, so M7's second division
    // will not need this rewritten for a different number of clubs.
    expect(bandFor(18, 20)?.label).toBe('table.band.relegation')
    expect(bandFor(17, 20)).toBeNull()

    // In a 22-club league the drop is 20th–22nd, not 18th.
    expect(bandFor(19, 22)).toBeNull()
    expect(bandFor(20, 22)?.label).toBe('table.band.relegation')
    expect(bandFor(22, 22)?.label).toBe('table.band.relegation')
  })
})

describe('the legend', () => {
  it('explains every band the table can produce', () => {
    useGame.getState().newGame()
    const { container } = render(<App />)
    openScreen('nav.table')

    // Scoped to the legend: each label also appears as a row's assistive text,
    // which is the point — but it means a document-wide query finds both.
    const legend = container.querySelector('.table-legend')
    expect(legend).not.toBeNull()

    const entries = [...(legend?.querySelectorAll('.table-legend__item') ?? [])].map((el) =>
      el.textContent?.trim(),
    )
    expect(entries).toEqual(BANDS.map((b) => t(b.label)))
  })

  it('gives each banded row text an assistive reader can use', () => {
    // Colour alone would say nothing to a reader who cannot see it.
    useGame.getState().newGame()
    render(<App />)
    openScreen('nav.table')

    const hidden = document.querySelectorAll('.data-table__band .visually-hidden')
    expect(hidden).toHaveLength(9)
  })
})

describe('sorting the classification', () => {
  /** Every row as `[position, club, goalsFor]`, in the order rendered. */
  function rows() {
    return [...document.querySelectorAll('.table-screen__main tbody tr')].map((tr) => {
      const cells = tr.querySelectorAll('td')
      return {
        position: Number(cells[1]?.textContent),
        // The badge sits in the same cell and carries the three-letter code, so the
        // cell's own text reads `BARBarcelona`. The name is the trailing text node.
        club:
          cells[1]?.nextElementSibling?.querySelector('.club-cell')?.lastChild?.textContent ?? '',
        lost: Number(cells[6]?.textContent),
        band: cells[0]?.className ?? '',
      }
    })
  }

  /** A part-played season, so the clubs are not all level on nothing. */
  function openPlayedTable() {
    useGame.getState().newGame()
    render(<App />)
    advance(40)
    openScreen('nav.table')
  }

  // Scoped to the table. Unscoped, `^L` matched the footer's Leave career button
  // as well as the Lost column — a one-letter header is not a unique name in a
  // document that also holds a shell.
  const header = (label: string) =>
    within(document.querySelector('.data-table') as HTMLElement).getByRole('button', {
      name: new RegExp(`^${label}`),
    })

  it('keeps the real league position on the row when sorted by something else', () => {
    // The headline risk, and the reason `Standing` bakes position and band in before
    // sorting. Read off the render index instead, the league's most-beaten club would
    // show as 1st wearing the champion's colours — a screen stating something false.
    //
    // Sorted on *defeats*, descending: the leader has among the fewest, so he is
    // driven far down the list. Written first against goals scored, this test passed
    // with the bug in place — the leader happened to be the top scorer too, so row 1
    // was the right answer for the wrong reason. Hence the guard below.
    openPlayedTable()
    const leader = rows()[0]
    expect(leader?.position).toBe(1)

    fireEvent.click(header(t('table.column.lost')))
    const sorted = rows()

    // Genuinely reordered, and sorted by the column asked for.
    const lost = sorted.map((r) => r.lost)
    expect(lost).toEqual([...lost].sort((a, b) => b - a))

    // Guard on the guard: if the leader were still on the top row, everything below
    // would hold under the very bug this exists to catch.
    const movedTo = sorted.findIndex((r) => r.club === leader?.club)
    expect(movedTo).toBeGreaterThan(0)

    // The champion's band and the number 1 travelled with the club, not with the
    // row — and nobody else acquired them.
    expect(sorted[movedTo]?.position).toBe(1)
    expect(sorted[movedTo]?.band).toMatch(/is-champion/)
    expect(sorted.filter((r) => r.band.includes('is-champion'))).toHaveLength(1)

    // And whoever is on the top row is wearing his own position, not a 1.
    expect(sorted[0]?.position).not.toBe(1)

    // Positions are a permutation of 1..20, not a re-count of the rows.
    expect([...sorted.map((r) => r.position)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it('cycles back to the classification, not to some other order', () => {
    // The home state of every other table is arbitrary; here it is the league itself.
    openPlayedTable()
    const original = rows().map((r) => r.club)

    const points = () => header(t('table.column.points'))
    fireEvent.click(points())
    fireEvent.click(points())
    fireEvent.click(points())

    expect(rows().map((r) => r.club)).toEqual(original)
    expect(rows().map((r) => r.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('sorts the club column by name, and survives a trip to the hub', () => {
    openPlayedTable()
    fireEvent.click(header(t('table.column.club')))
    fireEvent.click(header(t('table.column.club')))

    const names = rows().map((r) => r.club)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))

    // Sorting is a sitting concern: leaving the screen forgets it, which is the
    // same contract the market has always had.
    back()
    openScreen('nav.table')
    const table = computeTable(
      useGame.getState().game.competition.clubIds,
      useGame.getState().game.season.fixtures,
    )
    expect(rows().map((r) => r.position)).toEqual(table.map((_, i) => i + 1))
  })
})

describe('the crests', () => {
  /*
   * Read as text, because the app project runs with `css: false` and jsdom does
   * no layout — a rendered badge has no measurable size here at all.
   */
  const css = readFileSync(
    resolve(process.cwd(), 'packages/app/src/screens/TableScreen.css'),
    'utf8',
    // Comments stripped first: the note explaining the scoped rule naturally
    // names the token it exists *not* to touch, and a bare `toContain` reads
    // that sentence as a declaration. Third time this repo has been caught by
    // a comment scanned as the rule it describes.
  ).replace(/\/\*[\s\S]*?\*\//g, '')

  it('draws them larger here without touching the shared size', () => {
    // Scoped to this screen on purpose: `.club-badge.is-sm` serves eleven call
    // sites, the market's couple of hundred rows among them. Retuning the token
    // to enlarge the classification would enlarge all of them.
    expect(css).toMatch(/\.table-screen \.club-cell \.club-badge \{[^}]*width: 1\.75rem/)
    expect(css).not.toContain('.club-badge.is-sm')
  })

  it('pays for them out of the row padding, not the table height', () => {
    // The two halves only cancel together. The badge is taller than the text, so
    // it sets the row height; measured, enlarging it alone cost 165px of table at
    // 1440x900 and zeroing `padding-block` gives exactly that back. Shipping the
    // size without the padding is the regression this catches, and jsdom does no
    // layout, so reading the rule is the only guard available.
    expect(css).toMatch(/\.table-screen \.data-table__row td \{[^}]*padding-block: 0/)
  })
})

describe('the matchday', () => {
  /** The value beside the table's Matchday label. */
  const shown = () => {
    const label = within(document.querySelector('.table-screen__meta') as HTMLElement).getByText(
      t('table.matchday'),
    )
    return Number(label.nextElementSibling?.textContent)
  }

  it('is the round about to be played, the same one the hub names', () => {
    // It once counted rounds completed, so after six rounds the table said 6
    // while the hub said 7 — two numbers for one word.
    useGame.getState().newGame()
    render(<App />)
    advance(40)
    const next = matchdayFor(useGame.getState().game)?.fixture.round
    expect(next).toBeGreaterThan(1)

    openScreen('nav.table')
    expect(shown()).toBe(next)
  })
})
