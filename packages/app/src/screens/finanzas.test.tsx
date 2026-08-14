import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expansionCost, FINANCE, ledgerNet, STRIKES_ALLOWED } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { advanceUntil, back, openScreen } from '../testing.ts'
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

const game = () => useGame.getState().game
const club = () => game().clubs.find((c) => c.id === game().managedClubId)

describe('Caja', () => {
  it('shows every ledger line, so a ninth cannot go unreported', () => {
    // The screen's line table and the domain's LEDGER_KEYS have to stay in step.
    // ADR 0009 makes adding a line to the domain deliberate; this is what makes
    // failing to *show* it deliberate too.
    render(<App />)
    openScreen('Caja')

    // Scoped to the accounts table: "Salarios" is also the wage panel's heading,
    // so a document-wide query finds both.
    const table = document.querySelector('.caja-screen__main .data-table')
    /* c8 ignore next */
    if (table === null) throw new Error('no accounts table')

    for (const line of LINES) {
      expect(within(table as HTMLElement).getByText(line.label), line.label).toBeDefined()
    }
  })

  it('agrees with the balance the hub shows', () => {
    render(<App />)
    openScreen('Caja')

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
    openScreen('Caja')
    back()
    expect(screen.getByRole('heading', { name: 'Seguimiento' })).toBeDefined()
  })
})

describe('Decisiones', () => {
  it('says what the board wants and how much rope is left', () => {
    render(<App />)
    openScreen('Decisiones')

    const target = game().board.target
    expect(screen.getAllByText(`${String(target)}º`).length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.decisiones-screen__strike')).toHaveLength(STRIKES_ALLOWED)
  })

  it('spends a mark when a season is missed', () => {
    render(<App />)
    // Make the target unreachable, so the season below is certainly a miss.
    useGame.setState({ game: { ...game(), board: { ...game().board, target: 1 } } })

    advanceUntil(() => game().board.strikes > 0, 420)

    openScreen('Decisiones')
    expect(document.querySelectorAll('.decisiones-screen__strike.is-spent')).toHaveLength(1)
    expect(screen.getByText(/warned once/)).toBeDefined()
  })

  it('is explicit that only the table is judged', () => {
    // The natural assumption is that the money counts too, and it does not.
    render(<App />)
    openScreen('Decisiones')
    expect(screen.getByText(/does not look at your balance/)).toBeDefined()
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
    openScreen('Estadio')
    const fill = document.querySelector('.estadio-screen__gauge .attr__fill')
    expect(Number(fill?.getAttribute('data-fill'))).toBeGreaterThan(0)
  })

  it('moves the ticket price through the reducer', () => {
    render(<App />)
    openScreen('Estadio')

    const dearer = FINANCE.TICKET * 1.5
    fireEvent.change(screen.getByLabelText(/Precio/), { target: { value: String(dearer) } })

    expect(club()?.ticketPrice).toBeCloseTo(dearer, 6)
  })

  it('takes the money now and the seats next season', () => {
    render(<App />)
    openScreen('Estadio')

    const before = club()
    /* c8 ignore next */
    if (before === undefined) throw new Error('no club')
    const seats = 4000
    fireEvent.change(screen.getByLabelText(/Asientos/), { target: { value: String(seats) } })
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar obras' }))

    expect(club()?.budget).toBe(before.budget - expansionCost(seats))
    expect(club()?.capacity).toBe(before.capacity)
    expect(screen.getByText(/new seats are being built/)).toBeDefined()
  })

  it('shows a refusal rather than crashing', () => {
    render(<App />)
    openScreen('Estadio')

    fireEvent.change(screen.getByLabelText(/Asientos/), { target: { value: '999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar obras' }))

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
    expect(screen.getAllByText(/have dismissed you/).length).toBeGreaterThan(0)
    // No way to press on: the season-rollover button is gone.
    expect(screen.queryByRole('button', { name: /^Start \d{4}/ })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Nueva carrera' })[0] as HTMLElement)
    expect(useGame.getState().needsSetup).toBe(true)
  })

  it('leaves one warning perfectly playable', () => {
    render(<App />)
    useGame.setState({ game: { ...game(), board: { ...game().board, target: 1 } } })

    advanceUntil(() => game().board.strikes > 0, 420)

    expect(game().board.sacked).toBe(false)
    expect(screen.getByRole('button', { name: /^Start \d{4}/ })).toBeDefined()
  })
})

describe('the verdict reaches the feed', () => {
  it('tells you where you finished against what was asked', () => {
    render(<App />)
    advanceUntil(() => useGame.getState().game.board.strikes > 0 || seasonJudged(), 420)

    const drawer = screen.getByRole('button', { name: /^Noticias/ })
    fireEvent.click(drawer)
    expect(within(screen.getByLabelText('Noticias')).getAllByText(/board/i).length).toBeGreaterThan(
      0,
    )
  })
})

/** True once a BoardVerdict has been through the store's feed. */
function seasonJudged(): boolean {
  return useGame.getState().feed.some((event) => event.type === 'BoardVerdict')
}
