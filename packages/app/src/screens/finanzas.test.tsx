import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import {
  debtLimit,
  expansionCost,
  FINANCE,
  ledgerNet,
  ROUNDS_PER_HALF,
  seasonProjection,
  STRIKES_ALLOWED,
} from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advanceUntil, back, labelStem, openScreen } from '../testing.ts'
import { LINES, PROJECTED, signed } from './CajaScreen.tsx'
import { fillFor } from './EstadioScreen.tsx'
import { STADIUM_TIERS } from './stadium.ts'

/**
 * The three Finanzas screens, and the board behind them.
 *
 * These drive the real store and the real reducer. The claims are about what a
 * manager can see and do; the *rules* live in the domain's `board.test.ts` and
 * `finance.test.ts`.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const { t, money } = translatorFor('en')
const game = () => useGame.getState().game
const club = () => game().clubs.find((c) => c.id === game().managedClubId)

describe('Caja', () => {
  it('shows every ledger line, so a ninth cannot go unreported', () => {
    // The screen's line table and the domain's LEDGER_KEYS have to stay in step.
    // ADR 0009 makes adding a line to the domain deliberate; this is what makes
    // failing to *show* it deliberate too.
    render(<App />)
    openScreen('nav.caja')

    // Scoped to the accounts table: "Salarios" is also the wage panel's heading,
    // so a document-wide query finds both.
    const table = document.querySelector('.caja-screen__main .data-table')
    /* c8 ignore next */
    if (table === null) throw new Error('no accounts table')

    for (const line of LINES) {
      expect(within(table as HTMLElement).getByText(t(line.label)), line.label).toBeDefined()
    }
  })

  it('agrees with the balance the hub shows', () => {
    render(<App />)
    openScreen('nav.caja')

    const before = club()
    /* c8 ignore next */
    if (before === undefined) throw new Error('no club')
    // The result line is the ledger's net, which is the identity the domain
    // checks every tick — the screen states it rather than recomputing it.
    const total = LINES.reduce((sum, line) => sum + signed(before.ledger, line), 0)
    expect(total).toBe(ledgerNet(before.ledger))
  })

  /**
   * The overdraft is headroom, and it used to be printed as `-9.7M` beside a
   * balance that was in credit. Read as debt by the only person it was for.
   */
  it('states the overdraft as a ceiling, never as a negative beside the balance', () => {
    render(<App />)
    openScreen('nav.caja')

    const current = club()
    /* c8 ignore next */
    if (current === undefined) throw new Error('no club')
    const limit = debtLimit(current, game().competition.clubIds.length, ROUNDS_PER_HALF)

    const panel = document.querySelector('.caja-screen__side .caja-screen__stats')
    /* c8 ignore next */
    if (panel === null) throw new Error('no balance panel')
    const figures = within(panel as HTMLElement)

    expect(figures.getByText(t('caja.overdraftLimit'))).toBeDefined()
    expect(figures.getByText(money(limit))).toBeDefined()
    // The number a manager needs before he bids, and the one the reducer tests.
    expect(figures.getByText(t('caja.available'))).toBeDefined()
    expect(figures.getByText(money(current.budget + limit))).toBeDefined()
    // Nothing in this panel is a negative figure while the club is in credit.
    expect(panel.textContent).not.toMatch(/-/)
  })

  it('forecasts a whole season, and nets it against the wage bill', () => {
    render(<App />)
    openScreen('nav.caja')

    const current = club()
    /* c8 ignore next */
    if (current === undefined) throw new Error('no club')
    const forecast = seasonProjection(
      current,
      game().squads[current.id] ?? [],
      game().competition.clubIds,
      game().season.fixtures,
    )

    const panel = document.querySelector('.caja-screen__projection')
    /* c8 ignore next */
    if (panel === null) throw new Error('no forecast')
    const rows = within(panel as HTMLElement)

    for (const line of PROJECTED) {
      expect(rows.getByText(t(line.label)), line.label).toBeDefined()
    }
    // Stated, not recomputed by the screen — the same discipline the accounts
    // table follows against `ledgerNet`.
    //
    // Scoped to the total row rather than the whole panel: the net is one of six
    // figures formatted the same way, and it only takes two of them rounding to the
    // same €0.1M for a panel-wide `getByText` to fail on "found multiple" — which is
    // a collision, not a wrong number.
    const total = panel.querySelector('.caja-screen__total')
    /* c8 ignore next */
    if (total === null) throw new Error('no total row')
    expect(within(total as HTMLElement).getByText(money(forecast.net))).toBeDefined()
  })

  /**
   * The forecast has to be the manager's own ground, not the league default.
   * `annualIncome` deliberately ignores the slider because it sizes the
   * overdraft; a forecast that inherited that would be answering a different
   * question from the one the panel asks.
   */
  it('moves the forecast when the ticket price moves', () => {
    render(<App />)
    openScreen('nav.caja')
    const before = document.querySelector('.caja-screen__projection')?.textContent
    back()

    // Through the slider a manager actually uses, so this also says the two
    // Finanzas screens agree about the same ground.
    openScreen('nav.estadio')
    fireEvent.change(screen.getByLabelText(labelStem(t('estadio.price', { price: '' }))), {
      target: { value: String(FINANCE.TICKET * FINANCE.MIN_TICKET_FACTOR) },
    })
    back()

    openScreen('nav.caja')
    expect(document.querySelector('.caja-screen__projection')?.textContent).not.toBe(before)
  })

  it('comes back to the hub', () => {
    render(<App />)
    openScreen('nav.caja')
    back()
    expect(screen.getByRole('heading', { name: t('quadrant.seguimiento') })).toBeDefined()
  })
})

describe('Decisiones', () => {
  it('says what the board wants and how much rope is left', () => {
    render(<App />)
    openScreen('nav.decisiones')

    const target = game().board.target
    expect(screen.getAllByText(String(target)).length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.decisiones-screen__strike')).toHaveLength(STRIKES_ALLOWED)
  })

  it('spends a mark when a season is missed', () => {
    render(<App />)
    // Make the target unreachable, so the season below is certainly a miss.
    useGame.setState({ game: { ...game(), board: { ...game().board, target: 1 } } })

    advanceUntil(() => game().board.strikes > 0, 420)

    openScreen('nav.decisiones')
    expect(document.querySelectorAll('.decisiones-screen__strike.is-spent')).toHaveLength(1)
    expect(screen.getByText(t('board.warned'))).toBeDefined()
  })

  it('is explicit that only the table is judged', () => {
    // The natural assumption is that the money counts too, and it does not.
    render(<App />)
    openScreen('nav.decisiones')
    expect(screen.getByText(t('board.whatCountsNote'))).toBeDefined()
  })
})

describe('Estadio', () => {
  it('quantises the occupancy gauge into the bar primitive', () => {
    // The ficha's bar, reused. Width comes from a bucketed attribute, never a
    // JSX style prop — the 21 CSS rules exist so nobody reaches for one.
    expect(fillFor(0)).toBe(0)
    expect(fillFor(1)).toBe(20)
    expect(fillFor(0.5)).toBe(10)
    expect(fillFor(2)).toBe(20)
    expect(fillFor(-1)).toBe(0)

    render(<App />)
    openScreen('nav.estadio')
    const fill = document.querySelector('.estadio-screen__gauge .attr__fill')
    expect(Number(fill?.getAttribute('data-fill'))).toBeGreaterThan(0)
  })

  it('moves the ticket price through the reducer', () => {
    render(<App />)
    openScreen('nav.estadio')

    const dearer = FINANCE.TICKET * 1.5
    fireEvent.change(screen.getByLabelText(labelStem(t('estadio.price', { price: '' }))), {
      target: { value: String(dearer) },
    })

    expect(club()?.ticketPrice).toBeCloseTo(dearer, 6)
  })

  it('takes the money now and the seats next season', () => {
    render(<App />)
    openScreen('nav.estadio')

    const before = club()
    /* c8 ignore next */
    if (before === undefined) throw new Error('no club')
    const seats = 4000
    fireEvent.change(screen.getByLabelText(labelStem(t('estadio.seats', { cost: '' }))), {
      target: { value: String(seats) },
    })
    fireEvent.click(screen.getByRole('button', { name: t('estadio.begin') }))

    expect(club()?.budget).toBe(before.budget - expansionCost(seats))
    expect(club()?.capacity).toBe(before.capacity)
    expect(
      screen.getByText(
        new RegExp(t('estadio.underWay.other', { seats: '\\d[\\d,.]*', season: '.*' })),
      ),
    ).toBeDefined()
  })

  it('shows a refusal rather than crashing', () => {
    render(<App />)
    openScreen('nav.estadio')

    fireEvent.change(screen.getByLabelText(labelStem(t('estadio.seats', { cost: '' }))), {
      target: { value: '999999' },
    })
    fireEvent.click(screen.getByRole('button', { name: t('estadio.begin') }))

    expect(screen.getByRole('alert').textContent).toMatch(/runs from/)
    expect(club()?.expansion).toBeNull()
  })

  it('draws the ground the club actually has', () => {
    render(<App />)
    openScreen('nav.estadio')

    const capacity = club()?.capacity
    /* c8 ignore next */
    if (capacity === undefined) throw new Error('no club')

    // The ladder is restated by hand rather than read from `stadiumTierFor`.
    // Asking the function under test what it expects is a test that passes for
    // free — this one was written that way first and survived flattening the
    // whole function to `return 1`.
    const expected =
      capacity <= 18_000
        ? 1
        : capacity <= 24_000
          ? 2
          : capacity <= 32_000
            ? 3
            : capacity <= 42_000
              ? 4
              : capacity <= 55_000
                ? 5
                : capacity <= 75_000
                  ? 6
                  : capacity <= 105_000
                    ? 7
                    : 8

    for (const svg of document.querySelectorAll('.stadium')) {
      expect(svg.getAttribute('data-tier')).toBe(String(expected))
    }
    // Both views, side by side — the plan for the footprint, the section for the
    // height. One of them alone says nothing about the top half of the ladder.
    expect(document.querySelectorAll('.stadium')).toHaveLength(2)
  })

  it('builds another module every time the seats arrive', () => {
    // The point of the whole drawing. Capacity is set directly rather than built
    // up through a rollover, because *that* composition is already covered — the
    // test above takes the money and defers the seats, and the domain adds them
    // when the season opens. What is unproven without this is that the picture
    // follows the number.
    //
    // Counting *solid* modules rather than rects: every module is always in the
    // markup, because the unbuilt ones are what the ghost is made of. A rect
    // count is therefore constant, and the first version of this test asserted
    // exactly that and failed.
    render(<App />)
    openScreen('nav.estadio')

    const solid = () => document.querySelectorAll('.stadium [data-module]:not([data-ahead])').length

    const seen = STADIUM_TIERS.map((threshold, i) => {
      act(() => {
        useGame.setState({
          game: {
            ...game(),
            clubs: game().clubs.map((c) => (c.id === MID ? { ...c, capacity: threshold } : c)),
          },
        })
      })
      const svg = document.querySelector('.stadium')
      expect(svg?.getAttribute('data-tier'), `${String(threshold)} seats`).toBe(String(i + 1))
      return solid()
    })

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i], `tier ${String(i + 1)} built nothing new`).toBeGreaterThan(
        seen[i - 1] as number,
      )
    }
  })

  it('shows what is not built yet, faded, and stops once it is', () => {
    // "You can keep making it bigger" is the thing the drawing has to say at a
    // small club, and it can only say it by showing the modules that are missing.
    render(<App />)
    openScreen('nav.estadio')

    const ghosts = () => document.querySelectorAll('.stadium [data-module][data-ahead]').length
    const setCapacity = (capacity: number) => {
      act(() => {
        useGame.setState({
          game: {
            ...game(),
            clubs: game().clubs.map((c) => (c.id === MID ? { ...c, capacity } : c)),
          },
        })
      })
    }

    setCapacity(15_000)
    const small = ghosts()
    expect(small).toBeGreaterThan(0)
    // The nearest one is the most visible of them.
    expect(document.querySelectorAll('.stadium [data-ahead="next"]').length).toBeGreaterThan(0)

    setCapacity(90_000)
    expect(ghosts()).toBeLessThan(small)

    // Nothing left to build, so nothing left to fade.
    setCapacity(500_000)
    expect(ghosts()).toBe(0)
  })
})

describe('the sack', () => {
  it('ends the career, and the only way on is a new one', () => {
    // Two strikes, not one. The first miss has to leave the game playable or the
    // warning is not a warning.
    render(<App />)
    useGame.setState({ game: { ...game(), board: { ...game().board, target: 1, strikes: 1 } } })

    advanceUntil(() => game().board.sacked, 420)

    // Said twice on purpose: the panel where the fixture used to be, and the
    // news feed. A dismissal is not something to find out by accident.
    expect(screen.getAllByText(/dismissed you/).length).toBeGreaterThan(0)
    // No way to press on: the season-rollover button is gone.
    expect(
      screen.queryByRole('button', {
        name: new RegExp(`^${t('hub.startSeason', { season: '' }).trim()}`),
      }),
    ).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: t('action.quit') })[0] as HTMLElement)
    // Back at the front door, which is where a finished career ends. Deliberately
    // not `needsSetup`: quitting leaves the career in memory. What makes this a
    // dead end is the landing refusing to offer Continue once you are sacked.
    expect(useGame.getState().entry).toBe('landing')
  })

  it('leaves one warning perfectly playable', () => {
    render(<App />)
    useGame.setState({ game: { ...game(), board: { ...game().board, target: 1 } } })

    advanceUntil(() => game().board.strikes > 0, 420)

    expect(game().board.sacked).toBe(false)
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^${t('hub.startSeason', { season: '' }).trim()}`),
      }),
    ).toBeDefined()
  })
})

describe('the verdict reaches the feed', () => {
  it('tells you where you finished against what was asked', () => {
    render(<App />)
    advanceUntil(() => useGame.getState().game.board.strikes > 0 || seasonJudged(), 420)

    // Retargeted from the title bar's drawer, which the cog replaced, to the
    // hub's own news panel — the surface that survived.
    const panel = screen.getByRole('heading', { name: t('hub.news') }).closest('section')
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getAllByText(/board/i).length).toBeGreaterThan(0)
  })
})

/** True once a BoardVerdict has been through the store's feed. */
function seasonJudged(): boolean {
  return useGame.getState().feed.some((event) => event.type === 'BoardVerdict')
}
