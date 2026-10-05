import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
import { advanceUntil, back, labelStem, openScreen, confirm } from '../testing.ts'
import { LINES, PROJECTED, signed } from './CajaScreen.tsx'
import { fillFor } from './EstadioScreen.tsx'
import { seatsKey, STADIUM_ART, stadiumArtFor } from './stadium.ts'

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
    expect(screen.getByRole('heading', { level: 1, name: t('tab.today') })).toBeDefined()
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

  it('names the club without doubling its article', () => {
    // `board.demand` used to be `El {club} espera…`, and the fallback for a club
    // it cannot resolve is `The board` — so the sentence read "El La junta
    // espera" in Catalan the moment the lookup missed. The article lives at the
    // call site now, which is the only place that knows whether there is a club.
    const catalan = translatorFor('ca')
    useGame.setState({ language: 'ca' })
    render(<App />)
    openScreen('nav.decisiones')

    const demand = document.querySelector('.decisiones-screen__demand')?.textContent ?? ''
    expect(demand).toContain(catalan.club(club()?.name ?? '', { caps: true }))
    expect(demand.startsWith('El El')).toBe(false)

    useGame.setState({ language: 'en' })
  })

  it('falls back to the board’s own name with no article in front of it', () => {
    const catalan = translatorFor('ca')
    // A career whose managed club is not in the list — the only way the fallback
    // is reachable, and the state the doubled article used to render from.
    expect(
      catalan.t('board.demand', { club: catalan.t('board.fallbackName'), target: 5 }),
    ).toContain('La junta espera')
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
    confirm()

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
    confirm()

    expect(screen.getByRole('alert').textContent).toMatch(/runs from/)
    expect(club()?.expansion).toBeNull()
  })

  it('draws the ground the club actually has', () => {
    render(<App />)
    openScreen('nav.estadio')

    const capacity = club()?.capacity
    /* c8 ignore next */
    if (capacity === undefined) throw new Error('no club')

    // **Restated by hand rather than read from `stadiumArtFor`.** Asking the
    // function under test what it expects is a test that passes for free — this one
    // was written that way first and survived flattening the whole function to
    // `return 1`. These numbers are typed out here, not imported.
    const ladder = [
      6_000, 10_000, 11_000, 12_000, 13_000, 14_000, 15_000, 16_000, 17_000, 18_000, 19_000, 20_000,
      22_000, 23_000, 24_000, 25_000, 26_000, 27_000, 28_000, 29_000, 30_000, 31_000, 32_000,
      33_000, 34_000, 35_000, 36_000, 37_000, 38_000, 39_000, 40_000, 41_000, 42_000, 44_000,
      45_000, 46_000, 48_000, 50_000, 53_000, 55_000, 62_000, 65_000, 70_000, 75_000, 80_000,
      85_000, 90_000, 95_000, 100_000, 110_000, 130_000, 150_000, 170_000, 200_000,
    ]
    // Typed out above, compared to the source here: without this the literal only
    // guards whichever rungs *this* club's capacity happens to straddle, and moving
    // any other one failed nothing.
    expect(STADIUM_ART.map((rung) => rung.seats)).toEqual(ladder)

    // Deliberately *not* an argmin over `|seats - capacity|` — that is
    // `stadiumArtFor`'s own algorithm rewritten, so it would catch a wrong rung and
    // miss a flipped tie-break. Finding the first rung whose midpoint to the next is
    // at or above the capacity is different arithmetic reaching the same answer, and
    // the `<=` is what pins ties to the smaller drawing.
    const found = ladder.findIndex(
      (seats, i) => capacity <= (seats + (ladder[i + 1] ?? Infinity)) / 2,
    )
    const expected = ladder[found === -1 ? ladder.length - 1 : found]

    for (const art of document.querySelectorAll('.stadium')) {
      expect(art.getAttribute('data-seats')).toBe(seatsKey(expected as number))
    }
    // One painting now, not a plan and a section side by side — the pair existed
    // because neither drawn view could carry the whole ladder alone. See ADR 0012.
    expect(document.querySelectorAll('.stadium')).toHaveLength(1)
  })

  it('changes the ground every time the seats arrive', () => {
    // The point of the whole drawing: the picture follows the number. Capacity is
    // set directly rather than built up through a rollover, because *that*
    // composition is already covered — the test above takes the money and defers
    // the seats, and the domain adds them when the season opens.
    //
    // The claim with teeth is that every rung draws a different file: a component
    // that ignored its input and always served one image would satisfy `data-seats`
    // alone.
    render(<App />)
    openScreen('nav.estadio')

    const seen = STADIUM_ART.map((rung) => {
      act(() => {
        useGame.setState({
          game: {
            ...game(),
            clubs: game().clubs.map((c) => (c.id === MID ? { ...c, capacity: rung.seats } : c)),
          },
        })
      })
      const art = document.querySelector('.stadium')
      expect(art?.getAttribute('data-seats'), `${String(rung.seats)} seats`).toBe(
        seatsKey(rung.seats),
      )
      return art?.getAttribute('src') ?? ''
    })

    expect(new Set(seen).size, 'two grounds share a drawing').toBe(seen.length)
    for (const src of seen) expect(src).toMatch(/^\/art\/stadium\/\d+k[a-z]?\.webp$/)
  })

  it('rounds to the nearest ground, and gives a tie to the smaller one', () => {
    // **Nothing else reaches this.** The two tests above drive real club capacities
    // and exact rung values, and no club sits on a midpoint — so the rounding rule
    // and its tie-break are invisible to both. Checked by hand: 24k and 25k are
    // adjacent rungs, so 24,500 is exactly between them.
    const id = 'madrid'
    expect(stadiumArtFor(24_100, id).seats).toBe(24_000)
    expect(stadiumArtFor(24_900, id).seats).toBe(25_000)
    // The tie. Smaller, so the picture never claims more than the club has.
    expect(stadiumArtFor(24_500, id).seats).toBe(24_000)

    // Clamped at both ends rather than throwing: a career can build past anything
    // shipped, and a ground under the floor still has to render.
    expect(stadiumArtFor(1, id).seats).toBe(6_000)
    expect(stadiumArtFor(9_000_000, id).seats).toBe(200_000)
    expect(stadiumArtFor(Number.NaN, id).seats).toBe(6_000)
  })

  it('picks the same variant for a club every time, and not the same one for all', () => {
    // **The only thing that can see the variant selection.** Two drawings sharing a
    // capacity are interchangeable, so nothing about the rendered size or the rung
    // would change if the pick were hardcoded to the base file — and eight of the
    // twenty-five clubs sit between 21k and 25k, which is exactly where the variants
    // are and exactly why they must not all draw the same picture.
    const withVariants = STADIUM_ART.find((rung) => rung.variants > 0)
    /* c8 ignore next */
    if (withVariants === undefined) throw new Error('no variant to test')
    const { seats } = withVariants

    // Stable: the ground must not change under a club as the screen re-renders or a
    // save is reloaded, which is why this is derived from the id and never drawn.
    expect(stadiumArtFor(seats, 'madrid').file).toBe(stadiumArtFor(seats, 'madrid').file)

    const ids = game().clubs.map((c) => c.id)
    const drawn = new Set(ids.map((id) => stadiumArtFor(seats, id).file))
    expect(drawn.size, 'every club draws the same variant').toBeGreaterThan(1)
    // Whatever it picks has to exist. A negative modulo — `hashSeed` is signed —
    // yields an undefined suffix and a 404 nothing else here would catch.
    const legal = new Set(
      Array.from(
        { length: withVariants.variants + 1 },
        (_, i) => `${seatsKey(seats)}${i === 0 ? '' : String.fromCharCode(96 + i)}`,
      ),
    )
    for (const file of drawn) expect(legal.has(file), file).toBe(true)
  })

  it('draws a bigger ground bigger, not just differently', () => {
    // **The claim nothing else makes.** Every drawing is cropped to its own
    // content, so at one fixed height a 200,000-seat ground rendered exactly as
    // large as a 15,000-seat one and size said nothing at all. The scale is half
    // of what makes the ladder legible; flatten it and the seats attribute still
    // changes, the file still changes, and every other test here still passes.
    const css = readFileSync(
      resolve(process.cwd(), 'packages/design-system/src/components/StadiumView/StadiumView.css'),
      'utf8',
    )
    const heights = [
      ...css.matchAll(/\[data-seats='(\d+)k'\]\s*\{\s*--stadium-h:\s*([\d.]+)/g),
    ].map((m) => [Number(m[1]) * 1000, Number(m[2])] as const)

    // One rule per rung — a variant shares its base's size, so it gets no rule of
    // its own and a stray one here would mean the two had drifted apart.
    expect(heights).toHaveLength(STADIUM_ART.length)
    expect(heights.map((h) => h[0])).toEqual(STADIUM_ART.map((rung) => rung.seats))

    const ordered = [...heights].sort((a, b) => a[0] - b[0])
    for (let i = 1; i < ordered.length; i++) {
      expect(
        ordered[i]![1],
        `${String(ordered[i]![0])} seats is not taller than the ground below`,
      ).toBeGreaterThan(ordered[i - 1]![1])
    }
  })

  // **Deleted with the behaviour, not because it was inconvenient.** The drawing
  // used to render every module it had *not* earned yet, faded, so a small club
  // could see there was more to build. A painting has no modules to fade, so that
  // is a real feature this change costs — recorded in ADR 0012 rather than left
  // to be noticed later as a gap in the tests.
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

    // The day's action, which is the only way on once sacked; the bar's own
    // "quit" asks first, as it does at any time.
    const day = document.querySelector('.day-action') as HTMLElement
    fireEvent.click(within(day).getByRole('button', { name: t('action.quit') }))
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
