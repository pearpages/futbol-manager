import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expansionCost, FINANCE, ledgerNet, STRIKES_ALLOWED } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { advanceUntil, back, labelStem, openScreen } from '../testing.ts'
import { LINES, signed } from './CajaScreen.tsx'
import { fillFor } from './EstadioScreen.tsx'

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

const { t } = translatorFor('en')
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
    expect(screen.getAllByText(t('shell.position', { position: target })).length).toBeGreaterThan(0)
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

    fireEvent.click(
      screen.getAllByRole('button', { name: t('action.newCareer') })[0] as HTMLElement,
    )
    expect(useGame.getState().needsSetup).toBe(true)
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
