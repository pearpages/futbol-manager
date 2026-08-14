import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { askingPrice, bidIsLive, isTransferWindowOpen, surplus } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { listingsFor } from './MarketScreen.tsx'

/**
 * The market screen, driving the real store and the real reducer.
 *
 * Everything asserted here is deterministic. The claim that a signing changes
 * your *results* is statistical and belongs to the domain harness over twenty
 * seasons — a UI test that compared two single seasons would be measuring luck,
 * which this project has already been caught doing once.
 */

/** Madrid: rich enough that the affordability rules are not what is under test. */
const RICH = DEFAULT_CLUBS[0]?.id ?? ''

beforeEach(() => {
  useGame.getState().newGame(RICH)
})

const game = () => useGame.getState().game

function openMarket() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Market' }))
}

/** The row for the first listed player, which is also the best improvement. */
function firstListingRow() {
  const listings = listingsFor(
    game().squads[game().managedClubId] ?? [],
    game().squads,
    game().freeAgents,
    game().competition.clubIds,
    game().managedClubId,
    game().season.currentDate,
  )
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

    expect(screen.getByRole('alert').textContent).toMatch(/cannot afford/)
    expect(game().bids).toHaveLength(0)
  })

  it('completes a signing once the fee and the terms are both agreed', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    // The answer arrives with the clock, which is why bids are saved state.
    for (let day = 0; day < 5 && game().bids.some((b) => b.status === 'pending'); day++) {
      fireEvent.click(screen.getByRole('button', { name: 'Advance day' }))
    }
    expect(game().bids[0]?.status).toBe('accepted')

    fireEvent.click(screen.getByRole('button', { name: 'Market' }))
    fireEvent.click(screen.getByRole('button', { name: 'Offer terms' }))

    const squad = game().squads[game().managedClubId] ?? []
    expect(squad.some((p) => p.id === target.player.id)).toBe(true)
    expect(game().bids.filter(bidIsLive)).toHaveLength(0)
  })

  it('keeps a shortlist that survives navigation', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Watch' }))
    expect(game().shortlist).toEqual([target.player.id])

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    fireEvent.click(screen.getByRole('button', { name: 'Market' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist only' }))

    expect(screen.getByText(target.player.name)).toBeDefined()
  })

  it('opens the ficha for a player you do not own, and comes back', () => {
    openMarket()
    const { target } = firstListingRow()

    fireEvent.click(screen.getByRole('button', { name: target.player.name }))
    expect(screen.getByRole('heading', { name: target.player.name })).toBeDefined()

    // Closing used to always return to the squad, which loses your place here.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
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
      fireEvent.click(screen.getByRole('button', { name: 'Advance day' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Market' }))

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
      fireEvent.click(screen.getByRole('button', { name: /Advance day|Start \d{4}/ }))
    }

    const rollover = screen.getByRole('button', { name: /^Start 2027\/28$/ })
    expect(rollover.hasAttribute('disabled')).toBe(false)

    fireEvent.click(rollover)
    expect(game().season.startYear).toBe(2027)
    expect(game().season.fixtures.filter((f) => f.result !== null)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Advance day' })).toBeDefined()
  })
})
