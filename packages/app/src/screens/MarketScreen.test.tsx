import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import {
  askingPrice,
  bidIsLive,
  fromCivil,
  isTransferWindowOpen,
  needFor,
  surplus,
} from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { ADVANCE, advance, back, openScreen } from '../testing.ts'
import { listingsFor, marketSeed } from './MarketScreen.tsx'

/**
 * The market screen, driving the real store and the real reducer.
 *
 * Everything asserted here is deterministic. The claim that a signing changes
 * your *results* is statistical and belongs to the domain harness over twenty
 * seasons — a UI test that compared two single seasons would be measuring luck,
 * which this project has already been caught doing once.
 */

/** Madrid: rich enough that the affordability rules are not what is under test. */
const RICH = DEFAULT_CLUBS[0]?.id
if (RICH === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(RICH)
})

const game = () => useGame.getState().game

function openMarket() {
  render(<App />)
  openScreen('nav.market')
}

const bodyRows = () => [...document.querySelectorAll('.market-screen__main tbody tr')]

/** Names in the order the table shows them. */
const rowNames = () =>
  bodyRows().map((r) => r.querySelector('.market-screen__name')?.textContent ?? '')

/** Asking prices as numbers, for order assertions. `Free` sorts as zero. */
const rowFees = () =>
  bodyRows().map((r) => {
    const text = r.querySelectorAll('td')[6]?.textContent?.trim() ?? ''
    if (text === 'Free') return 0
    const value = Number(text.replace(/[€kM]/g, ''))
    return text.endsWith('M') ? value * 1000 : value
  })

/** The row for the first player in market order. */
function firstListingRow() {
  const listings = listingsFor(game())
  const target = listings[0]
  if (target === undefined) throw new Error('nothing on the market')
  const row = screen.getByText(target.player.name).closest('tr')
  if (row === null) throw new Error('no row for the target')
  return { target, row }
}

describe('the market screen', () => {
  it('is reachable from the shell', () => {
    openMarket()
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })

  it('shows the budget in money, not raw thousands', () => {
    openMarket()
    // The domain deals in thousands; a screen that printed them raw would be read
    // wrong every time.
    expect(screen.getByText('Budget')).toBeDefined()
    expect(document.body.textContent).toMatch(/€[\d.]+[kM]/)
  })

  it('lists only players another club has actually put up for sale', () => {
    openMarket()
    const state = game()
    const listed = new Set(
      state.competition.clubIds
        .filter((id) => id !== state.managedClubId)
        .flatMap((id) => surplus(state.squads[id] ?? []).map((p) => p.name)),
    )

    // Your own players are never on the market, and neither is anyone's starter.
    for (const own of state.squads[state.managedClubId] ?? []) {
      expect(screen.queryByText(own.name)).toBeNull()
    }
    const { target } = firstListingRow()
    expect(listed.has(target.player.name)).toBe(true)
  })

  it('makes a bid that lands in game state', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    const bid = game().bids.find((b) => b.playerId === target.player.id)
    expect(bid).toBeDefined()
    expect(bid?.from).toBe(game().managedClubId)
    expect(bid?.fee).toBe(askingPrice(target.player, game().season.currentDate))
  })

  it('shows a refusal instead of crashing', () => {
    openMarket()
    const { row } = firstListingRow()
    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))

    const fee = screen.getByLabelText(/^Fee/)
    fireEvent.change(fee, { target: { value: '99999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    expect(screen.getByRole('alert').textContent).toMatch(/overdraft limit/)
    expect(game().bids).toHaveLength(0)
  })

  it('completes a signing once the fee and the terms are both agreed', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    // Wait somewhere other than the market, which is what a manager does and
    // what keeps this test honest about cost: the full listing is a few hundred
    // rows, and re-rendering it on every tick measures the table rather than the
    // bid.
    back()

    // The answer arrives with the clock, which is why bids are saved state.
    for (let day = 0; day < 5 && game().bids.some((b) => b.status === 'pending'); day++) {
      advance()
    }
    expect(game().bids[0]?.status).toBe('accepted')

    // Coming back, the negotiation panel is closed — leaving the screen drops it.
    // "Your bids" is how you pick the deal back up, which is the point of that
    // panel existing.
    openScreen('nav.market')
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Offer terms' }))

    const squad = game().squads[game().managedClubId] ?? []
    expect(squad.some((p) => p.id === target.player.id)).toBe(true)
    // Only our own bids. Since M4c the clock also brings in offers for our players,
    // so `bids` runs in both directions.
    expect(
      game()
        .bids.filter((b) => b.from === RICH)
        .filter(bidIsLive),
    ).toHaveLength(0)
  })

  it('keeps a shortlist that survives navigation', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Watch' }))
    expect(game().shortlist).toEqual([target.player.id])

    back()
    openScreen('nav.table')
    back()
    openScreen('nav.market')
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist only' }))

    expect(screen.getByText(target.player.name)).toBeDefined()
  })

  it('opens the ficha for a player you do not own, and comes back', () => {
    openMarket()
    const { target } = firstListingRow()

    fireEvent.click(screen.getByRole('button', { name: target.player.name }))
    expect(screen.getByRole('heading', { name: target.player.name })).toBeDefined()

    // Closing used to always return to the squad, which loses your place here.
    back()
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })
})

describe('reaching the whole market', () => {
  /**
   * Until now the screen sliced the list to sixty rows with no filter, no sort and
   * no pager, so the rest were simply unreachable. Worse than incomplete: the sort
   * is by how much a player improves your XI, and the biggest improvements are the
   * most expensive, so a weak club saw sixty players it could not afford while the
   * ninety-odd useful signings inside its budget sat below the cut.
   */
  const allListings = () => listingsFor(game())

  it('renders every listing, not the first sixty', () => {
    openMarket()
    const total = allListings().length
    expect(total).toBeGreaterThan(60)
    expect(bodyRows()).toHaveLength(total)
    expect(screen.getByText(`Showing ${total} of ${total}`)).toBeDefined()
  })

  it('filters to a position', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'GK' }))

    const keepers = allListings().filter((l) => l.player.position === 'GK')
    expect(keepers.length).toBeGreaterThan(0)
    expect(bodyRows()).toHaveLength(keepers.length)
    for (const row of bodyRows()) {
      expect(within(row as HTMLElement).getByText('GK')).toBeDefined()
    }
  })

  it('combines positions rather than replacing them', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'GK' }))
    fireEvent.click(screen.getByRole('button', { name: 'FW' }))

    const both = allListings().filter(
      (l) => l.player.position === 'GK' || l.player.position === 'FW',
    )
    expect(bodyRows()).toHaveLength(both.length)
  })

  it('filters to what you can pay for', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Within budget' }))

    const budget = game().clubs.find((c) => c.id === game().managedClubId)?.budget ?? 0
    const affordable = allListings().filter((l) => l.fee <= budget)
    expect(bodyRows()).toHaveLength(affordable.length)
  })

  it('filters to free agents', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Free agents' }))
    // A fresh league has an empty pool — nobody is out of contract until the first
    // rollover — so this correctly shows nothing rather than everything.
    expect(bodyRows()).toHaveLength(allListings().filter((l) => l.from === null).length)
  })

  it('says so when the filters exclude everybody', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Free agents' }))
    expect(screen.getByText('Nobody matches those filters.')).toBeDefined()
  })
})

describe('the market does not do your scouting', () => {
  /**
   * The screen used to carry an "Improves" column — `needFor`, rendered — which
   * told you outright which signing would strengthen your team. That turned the
   * market into a lookup. The number still drives the AI, and is documented in
   * docs/market-model.md; it is simply not shown, and the list is shuffled so the
   * best players are not conveniently at the top either.
   */
  it('shows no improvement score anywhere', () => {
    openMarket()
    expect(screen.queryByText('Improves')).toBeNull()
    // Nothing of the form "+6.0" survives in the table.
    expect(document.querySelector('.market-screen__main')?.textContent).not.toMatch(/\+\d+\.\d/)
  })

  it('does not order the list by quality, price or age', () => {
    openMarket()
    const overalls = bodyRows().map((r) => Number(r.querySelectorAll('td')[4]?.textContent))
    const fees = rowFees()
    const ages = bodyRows().map((r) => Number(r.querySelectorAll('td')[3]?.textContent))

    const sorted = (v: number[]) =>
      v.every((n, i) => i === 0 || n <= (v[i - 1] ?? 0)) ||
      v.every((n, i) => i === 0 || n >= (v[i - 1] ?? 0))

    expect(sorted(overalls)).toBe(false)
    expect(sorted(fees)).toBe(false)
    expect(sorted(ages)).toBe(false)
  })

  it('holds the same order across navigation, rather than reshuffling', () => {
    // A list that moved every render would be unusable.
    openMarket()
    const first = rowNames()

    back()
    openScreen('nav.table')
    back()
    openScreen('nav.market')

    expect(rowNames()).toEqual(first)
  })

  it('deals a different market for the January window', () => {
    const august = game().season.currentDate
    const january = fromCivil(2027, 1, 10)
    expect(marketSeed(august, game().managedClubId)).not.toBe(
      marketSeed(january, game().managedClubId),
    )
    // …and holds still within a window: mid-September belongs to August's.
    expect(marketSeed(fromCivil(2026, 9, 20), game().managedClubId)).toBe(
      marketSeed(august, game().managedClubId),
    )
  })

  it('deals a different market to each club', () => {
    const date = game().season.currentDate
    const other = DEFAULT_CLUBS[5]?.id
    if (other === undefined) throw new Error('no clubs')
    expect(marketSeed(date, RICH)).not.toBe(marketSeed(date, other))
  })
})

describe('sorting the market', () => {
  const firstRowName = () => rowNames()[0] ?? ''
  const header = (label: string) =>
    screen.getByRole('button', { name: new RegExp(`^${label}`) }).closest('th')

  it('starts unsorted — market order is the shuffle', () => {
    openMarket()
    for (const label of ['Player', 'Club', 'Age', 'Ovr', 'Asking']) {
      expect(header(label)?.getAttribute('aria-sort')).toBe('none')
    }
  })

  it('sorts by asking price, cheapest first on a second click', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: /^Asking/ }))
    expect(header('Asking')?.getAttribute('aria-sort')).toBe('descending')
    const dearest = firstRowName()

    fireEvent.click(screen.getByRole('button', { name: /^Asking/ }))
    expect(header('Asking')?.getAttribute('aria-sort')).toBe('ascending')
    expect(firstRowName()).not.toBe(dearest)

    // Cheapest first: this is how a club with no money finds what it can buy.
    const fees = rowFees()
    expect(fees).toEqual([...fees].sort((a, b) => a - b))
  })

  it('cycles back to market order on a third click', () => {
    // Without a way back, one click would cost you the shuffle for the session.
    openMarket()
    const shuffled = rowNames()

    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))
    expect(rowNames()).not.toEqual(shuffled)
    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))

    expect(header('Ovr')?.getAttribute('aria-sort')).toBe('none')
    expect(rowNames()).toEqual(shuffled)
  })

  it('moves the marker to whichever column is active', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: /^Age/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))
    expect(header('Ovr')?.getAttribute('aria-sort')).toBe('descending')
    expect(header('Age')?.getAttribute('aria-sort')).toBe('none')
  })
})

describe('a club with no money', () => {
  // The case the sixty-row cap broke: at Almería 198 of 228 listings improve the
  // XI and 125 are affordable, but only five of the visible sixty were both.
  const POOR = DEFAULT_CLUBS.at(-1)?.id
  if (POOR === undefined) throw new Error('no clubs')

  it('can reach the signings it can actually afford', () => {
    useGame.getState().newGame(POOR)
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Within budget' }))

    const budget = game().clubs.find((c) => c.id === POOR)?.budget ?? 0
    // `needFor` is a domain question now — the screen deliberately no longer
    // answers it for you, so the test asks the domain directly.
    const squad = game().squads[POOR] ?? []
    const useful = listingsFor(game()).filter(
      (l) => l.fee <= budget && needFor(squad, l.player) > 0,
    )

    expect(useful.length).toBeGreaterThan(20)
    const shown = new Set(rowNames())
    for (const listing of useful) expect(shown.has(listing.player.name)).toBe(true)
  })
})

describe('the window', () => {
  it('is open at the start of a season', () => {
    expect(isTransferWindowOpen(game().season.currentDate)).toBe(true)
  })

  it('closes bidding once it shuts', () => {
    // Run to October, well past August.
    render(<App />)
    for (let day = 0; day < 60; day++) {
      advance()
    }
    openScreen('nav.market')

    expect(screen.getByText(/The window is shut/)).toBeDefined()
    for (const button of screen.getAllByRole('button', { name: 'Bid' })) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
  })
})

describe('the end of a season', () => {
  it('is a door to the next one rather than a dead end', () => {
    // Before M4b this button read "Season over" and was disabled forever, because
    // nothing in the UI could reach a rollover.
    render(<App />)
    const played = () => game().season.fixtures.filter((f) => f.result !== null).length
    for (let day = 0; day < 400 && played() < 380; day++) {
      advance()
    }

    const rollover = screen.getByRole('button', { name: /^Start 2027\/28$/ })
    expect(rollover.hasAttribute('disabled')).toBe(false)

    fireEvent.click(rollover)
    expect(game().season.startYear).toBe(2027)
    expect(game().season.fixtures.filter((f) => f.result !== null)).toHaveLength(0)
    expect(screen.getByRole('button', { name: ADVANCE() })).toBeDefined()
  })
})
