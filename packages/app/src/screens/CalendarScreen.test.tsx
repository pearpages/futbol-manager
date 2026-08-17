import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { nextFixtureFor, seasonEvents, TOTAL_ROUNDS } from '@fm/domain'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advance, openScreen } from '../testing.ts'

/**
 * The calendar — your fixtures with the league's deadlines among them.
 *
 * Drives the real store and the real reducer through the hub, which is the only
 * door: there is no router.
 */

const { t, date } = translatorFor('en')

beforeEach(() => {
  useGame.getState().newGame()
})

const game = () => useGame.getState().game

const openCalendar = () => {
  render(<App />)
  openScreen('nav.calendar')
}

/**
 * Plays `days` first, then opens the screen.
 *
 * The clock has to move **before** the screen opens: on a day your fixture is due,
 * the footer's button off the hub navigates to the hub rather than kicking off, so
 * `advance()` from here would not resolve. `ResultsScreen.test.tsx` says the same.
 */
const openPlayed = (days: number) => {
  render(<App />)
  advance(days)
  openScreen('nav.calendar')
}

/** Every row, as `[jornada, date, opponent-or-event, result]`. */
function rows(): string[][] {
  return [...document.querySelectorAll('tbody .data-table__row')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
  )
}

const fixtureRows = () =>
  [...document.querySelectorAll('tbody .data-table__row')].filter(
    (row) => !row.classList.contains('calendar-screen__event'),
  )

describe('the calendar', () => {
  it('lists your whole season and nobody else’s', () => {
    openCalendar()
    // 38 of your own out of 380 — the screen is your fixture list, not the league's.
    expect(fixtureRows()).toHaveLength(TOTAL_ROUNDS)
  })

  it('runs in date order, fixtures and deadlines together', () => {
    openCalendar()
    const shown = rows().map((cells) => cells[1] ?? '')
    // Reading the dates back as text is the point: a sort on the wrong key, or a
    // deadline appended after the fixtures, both show up here.
    const dates = shown.map((text) => {
      const [d, m, y] = text.split('/')
      return `${y ?? ''}${(m ?? '').padStart(2, '0')}${(d ?? '').padStart(2, '0')}`
    })
    expect([...dates].sort()).toEqual(dates)
  })

  it('carries every deadline the season enforces', () => {
    openCalendar()
    const events = seasonEvents(game().season.fixtures)
    const text = document.body.textContent ?? ''

    // Nine settlements, three window edges and the season's end, each at its date.
    // The market **shuts twice** — 1 September and 1 February — and opens once
    // inside the season, on 1 January; the summer opening happens on 1 July, which
    // the day clock never reaches because the rollover jumps over it.
    expect(events).toHaveLength(13)
    for (const event of events) {
      expect(text.includes(date(event.date)), date(event.date)).toBe(true)
    }
    expect(screen.getAllByText(t('calendar.settlement'))).toHaveLength(9)
    expect(screen.getAllByText(t('calendar.windowCloses'))).toHaveLength(2)
    expect(screen.getByText(t('calendar.windowOpens'))).toBeDefined()
    expect(screen.getByText(t('calendar.seasonEnds'))).toBeDefined()
  })

  it('closes on the last jornada’s own date', () => {
    openCalendar()
    const last = Math.max(...game().season.fixtures.map((f) => f.date))
    const closing = rows().at(-1)

    expect(closing?.[2]).toBe(t('calendar.seasonEnds'))
    expect(closing?.[1]).toBe(date(last as never))
  })

  it('marks the match you have to play next', () => {
    openPlayed(10)
    const next = nextFixtureFor(game().season.fixtures, game().managedClubId)
    const marked = document.querySelectorAll('.calendar-screen__next')

    // Exactly one, and it is the fixture the reducer would resolve — not simply the
    // first unplayed row. `advanceDay` plays everything *due*, so a fixture the
    // clock has passed is still owed and is still next.
    expect(marked).toHaveLength(1)
    expect(marked[0]?.textContent).toContain(date(next?.date as never))
    expect(marked[0]?.getAttribute('aria-current')).toBe('true')
  })

  /*
   * **An away 0–2 is a win**, and reading the score straight off the fixture
   * inverts every away row — plausibly, because nothing on the screen contradicts
   * it. So this asserts the flip from both ends: the same fixture read by its home
   * club and by its away club has to come out mirrored.
   */
  it('reads a score from your own end of the pitch', () => {
    openPlayed(2)

    const fixture = game().season.fixtures.find(
      (f) => f.result !== null && f.result.home !== f.result.away,
    )
    if (fixture?.result == null) throw new Error('no decisive fixture played')

    /*
     * Switching the managed club rather than navigating: the screen subscribes to
     * `game`, so the same rendered fixture is re-read from the other end of the
     * pitch. A second career at the other club would not share a fixture, and
     * that is the only way to compare the two readings of *one* score.
     */
    const asSeenBy = (clubId: string) => {
      act(() => {
        useGame.setState({ game: { ...game(), managedClubId: clubId as never } })
      })
      const row = [...fixtureRows()].find(
        (r) => r.textContent?.includes(date(fixture.date)) === true,
      )
      return row?.querySelector('.calendar-screen__score')
    }

    const { home: h, away: a } = fixture.result
    const home = asSeenBy(fixture.homeId)
    expect(home?.textContent).toContain(`${h}–${a}`)
    expect(home?.className).toContain(h > a ? 'is-win' : 'is-loss')

    const away = asSeenBy(fixture.awayId)
    expect(away?.textContent).toContain(`${a}–${h}`)
    // The verdict has to flip with the score: one of them won and the other lost.
    expect(away?.className).toContain(h > a ? 'is-loss' : 'is-win')
  })

  it('says the result in words as well as in colour', () => {
    openPlayed(2)
    const score = document.querySelector(
      '.calendar-screen__score.is-win, .calendar-screen__score.is-loss',
    )
    const hidden = score?.querySelector('.visually-hidden')?.textContent ?? ''

    // Colour is never the only signal — and the leading space matters, because
    // nothing in the DOM separates this from the score beside it.
    expect([t('calendar.won'), t('calendar.lost')]).toContain(hidden.trim())
    expect(hidden.startsWith(' ')).toBe(true)
  })

  it('shows an unplayed fixture as having no score yet', () => {
    openCalendar()
    // Every fixture is unplayed on day one, so no row can claim an outcome.
    expect(document.querySelectorAll('.calendar-screen__score.is-win')).toHaveLength(0)
    expect(document.querySelectorAll('.calendar-screen__score.is-draw')).toHaveLength(0)
    expect(document.querySelectorAll('.calendar-screen__score.is-loss')).toHaveLength(0)
  })

  /*
   * The whole reason the screen is usable in March: opening it puts you where the
   * season is, not at jornada 1 in August. jsdom implements no scrolling, so the
   * behaviour is only observable by watching the call — but *which element* it is
   * called on is the assertion that matters.
   */
  it('opens where the season is, not at the top', () => {
    const scrolled: Element[] = []
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
      this: Element,
    ) {
      scrolled.push(this)
    })

    try {
      openPlayed(10)
      const next = document.querySelector('.calendar-screen__next')

      expect(next).not.toBeNull()
      expect(scrolled).toContain(next)
    } finally {
      spy.mockRestore()
    }
  })

  it('does not offer to sort itself', () => {
    openCalendar()
    // The order *is* the information, so there is no control that can destroy it.
    expect(document.querySelectorAll('.data-table__sort')).toHaveLength(0)
  })

  it('explains the dates rather than only listing them', () => {
    openCalendar()
    expect(
      screen.getByRole('button', {
        name: t('explain.open', { topic: t('explain.calendar.title') }),
      }),
    ).toBeDefined()
  })
})
