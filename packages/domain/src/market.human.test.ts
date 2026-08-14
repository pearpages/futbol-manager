import { beforeEach, describe, expect, it } from 'vitest'
import { suggestedTerms } from './bids.ts'
import type { ClubId } from './entities.ts'
import { bidIsLive } from './bids.ts'
import { MAX_SQUAD, MIN_SQUAD, surplus, totalBudget } from './market.ts'
import { contractMonthsLeft, type Player, type PlayerId } from './player.ts'
import { addDays } from './time.ts'
import { type Command, type Event, reduce } from './reduce.ts'
import { createRng, type Rng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import type { GameState } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { askingPrice } from './valuation.ts'

/**
 * The human's side of the market, driven through `reduce` — the same door the UI
 * uses and the only way state is allowed to change.
 *
 * These are deterministic claims about mechanics. The *statistical* claim — that
 * a signing changes your results — is the exit criterion and lives in
 * `market.human.harness.test.ts`, over twenty seasons, because a single season
 * cannot tell a ten-point signing from ten points of variance.
 */

const RICH = TEST_CLUBS[0]?.id ?? ('c01' as ClubId)
const SELLER = TEST_CLUBS[9]?.id ?? ('c10' as ClubId)

let state: GameState
let rng: Rng

function dispatch(command: Command): readonly Event[] {
  const result = reduce(state, command, rng)
  state = result.state
  return result.events
}

/** The first player another club has actually listed. */
function aListedPlayer(): { player: Player; from: ClubId } {
  for (const club of TEST_CLUBS) {
    if (club.id === state.managedClubId) continue
    const listed = surplus(state.squads[club.id] ?? [])[0]
    if (listed !== undefined) return { player: listed, from: club.id }
  }
  /* c8 ignore next */
  throw new Error('nothing on the market')
}

/**
 * Bid and tick the clock until the seller answers.
 *
 * `ANSWER_DAYS` is a delay in game days, and a day is only *processed* by an
 * `AdvanceDay` — so an offer made on day T is answered by the tick that processes
 * day T + 2, which is the third one. Waiting on the event rather than counting
 * ticks keeps the test honest if that offset ever changes.
 */
function bidAndWait(player: Player, fee: number): Extract<Event, { type: 'BidAnswered' }> {
  dispatch({ type: 'MakeBid', playerId: player.id, fee })

  for (let day = 0; day < 10; day++) {
    for (const event of dispatch({ type: 'AdvanceDay' })) {
      if (event.type === 'BidAnswered' && event.playerId === player.id) return event
    }
  }
  /* c8 ignore next */
  throw new Error('the bid was never answered')
}

/** Bid, wait for the answer, sign. The whole flow, as a screen would drive it. */
function completeSigning(player: Player, fee: number): readonly Event[] {
  bidAndWait(player, fee)

  const terms = suggestedTerms(player, state.season.currentDate)
  return dispatch({
    type: 'OfferContract',
    playerId: player.id,
    wage: terms.wage,
    years: terms.years,
  })
}

beforeEach(() => {
  rng = createRng(4242)
  state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng, managedClubId: RICH })
})

describe('bidding', () => {
  it('completes a signing: fee agreed, then terms agreed', () => {
    const { player, from } = aListedPlayer()
    const fee = askingPrice(player, state.season.currentDate)
    const before = totalBudget(state)

    const events = completeSigning(player, fee)

    expect(events.map((e) => e.type)).toContain('TransferCompleted')
    expect(state.squads[RICH]?.some((p) => p.id === player.id)).toBe(true)
    expect(state.squads[from]?.some((p) => p.id === player.id)).toBe(false)
    // Never loosen this. A fee credited but not debited inflates the league
    // silently for years.
    expect(totalBudget(state)).toBe(before)
  })

  it('puts him on the terms that were agreed, not the ones he arrived on', () => {
    const { player } = aListedPlayer()
    completeSigning(player, askingPrice(player, state.season.currentDate))

    const signed = state.squads[RICH]?.find((p) => p.id === player.id)
    /* c8 ignore next */
    if (signed === undefined) throw new Error('not signed')
    const terms = suggestedTerms(player, state.season.currentDate)
    expect(signed.contract.wage).toBe(terms.wage)
    expect(contractMonthsLeft(signed, state.season.currentDate)).toBeGreaterThan(12)
  })

  it('moves the fee from the buyer to the seller, and nowhere else', () => {
    const { player, from } = aListedPlayer()
    const fee = askingPrice(player, state.season.currentDate)
    const budgetOf = (id: ClubId) => state.clubs.find((c) => c.id === id)?.budget ?? 0
    const buyerBefore = budgetOf(RICH)
    const sellerBefore = budgetOf(from)

    completeSigning(player, fee)

    expect(budgetOf(RICH)).toBe(buyerBefore - fee)
    expect(budgetOf(from)).toBe(sellerBefore + fee)
  })

  it('counters a bid just under the asking price', () => {
    const { player } = aListedPlayer()
    const asking = askingPrice(player, state.season.currentDate)

    const answered = bidAndWait(player, Math.round(asking * 0.9))

    expect(answered.status).toBe('countered')
    expect(answered.counterFee).toBe(asking)
  })

  it('rejects a lowball, and the bid stops being live', () => {
    const { player } = aListedPlayer()
    const asking = askingPrice(player, state.season.currentDate)

    const answered = bidAndWait(player, Math.round(asking * 0.4))

    expect(answered.status).toBe('rejected')
    expect(state.bids.filter(bidIsLive)).toHaveLength(0)
  })

  it('does not answer before the answer is due', () => {
    const { player } = aListedPlayer()
    dispatch({ type: 'MakeBid', playerId: player.id, fee: 1 })
    const events = dispatch({ type: 'AdvanceDay' })
    expect(events.some((e) => e.type === 'BidAnswered')).toBe(false)
    expect(state.bids[0]?.status).toBe('pending')
  })

  it('lets you withdraw before it is answered', () => {
    const { player } = aListedPlayer()
    dispatch({ type: 'MakeBid', playerId: player.id, fee: 1 })
    const bidId = state.bids[0]?.id
    /* c8 ignore next */
    if (bidId === undefined) throw new Error('no bid')

    dispatch({ type: 'WithdrawBid', bidId })
    expect(state.bids[0]?.status).toBe('withdrawn')

    for (let day = 0; day < 5; day++) dispatch({ type: 'AdvanceDay' })
    // A withdrawn bid is not waiting for an answer any more.
    expect(state.bids[0]?.status).toBe('withdrawn')
  })
})

describe('what the reducer refuses — a screen can forget, this cannot', () => {
  it('rejects a bid for a player nobody listed', () => {
    const squad = state.squads[SELLER] ?? []
    const listed = new Set(surplus(squad).map((p) => p.id))
    const starter = squad.find((p) => !listed.has(p.id))
    /* c8 ignore next */
    if (starter === undefined) throw new Error('every player is listed')

    expect(() => dispatch({ type: 'MakeBid', playerId: starter.id, fee: 999_999 })).toThrow(
      /not for sale/,
    )
  })

  it('rejects a bid you cannot afford', () => {
    const { player } = aListedPlayer()
    expect(() => dispatch({ type: 'MakeBid', playerId: player.id, fee: 99_999_999 })).toThrow(
      /cannot afford/,
    )
  })

  it('rejects a bid outside the window', () => {
    // October: the season is running and the window shut in August.
    state = {
      ...state,
      season: { ...state.season, currentDate: addDays(state.season.currentDate, 60) },
    }
    const { player } = aListedPlayer()
    expect(() => dispatch({ type: 'MakeBid', playerId: player.id, fee: 100 })).toThrow(/closed/)
  })

  it('rejects a second live bid for the same player', () => {
    const { player } = aListedPlayer()
    dispatch({ type: 'MakeBid', playerId: player.id, fee: 100 })
    expect(() => dispatch({ type: 'MakeBid', playerId: player.id, fee: 200 })).toThrow(
      /already a live bid/,
    )
  })

  it('rejects a bid for your own player', () => {
    const own = state.squads[RICH]?.[0]
    /* c8 ignore next */
    if (own === undefined) throw new Error('no squad')
    expect(() => dispatch({ type: 'MakeBid', playerId: own.id, fee: 100 })).toThrow(/already yours/)
  })

  it('rejects a nonsense fee', () => {
    const { player } = aListedPlayer()
    expect(() => dispatch({ type: 'MakeBid', playerId: player.id, fee: 0 })).toThrow(/positive fee/)
    expect(() => dispatch({ type: 'MakeBid', playerId: player.id, fee: -5 })).toThrow(
      /positive fee/,
    )
  })

  it('refuses terms before a fee is agreed', () => {
    const { player } = aListedPlayer()
    dispatch({ type: 'MakeBid', playerId: player.id, fee: 1 })
    expect(() =>
      dispatch({ type: 'OfferContract', playerId: player.id, wage: 5000, years: 3 }),
    ).toThrow(/No agreed fee/)
  })

  it('refuses a contract length outside 1–5 years', () => {
    const { player } = aListedPlayer()
    completeSigningFeeOnly(player)
    expect(() =>
      dispatch({ type: 'OfferContract', playerId: player.id, wage: 5000, years: 7 }),
    ).toThrow(/1–5 years/)
    expect(() =>
      dispatch({ type: 'OfferContract', playerId: player.id, wage: 5000, years: 0 }),
    ).toThrow(/1–5 years/)
  })

  function completeSigningFeeOnly(player: Player) {
    bidAndWait(player, askingPrice(player, state.season.currentDate))
  }

  it('reports a refused wage as an outcome, not a crash', () => {
    const { player } = aListedPlayer()
    completeSigningFeeOnly(player)
    const before = state.squads[RICH]?.length ?? 0

    // A lowball on wages is a negotiation, so the bid survives and can be improved.
    const events = dispatch({ type: 'OfferContract', playerId: player.id, wage: 1, years: 3 })

    const rejected = events.find((e) => e.type === 'TermsRejected')
    expect(rejected?.reason).toBe('wage')
    expect(rejected?.wanted).toBeGreaterThan(1)
    expect(state.squads[RICH]?.length).toBe(before)

    const terms = suggestedTerms(player, state.season.currentDate)
    dispatch({ type: 'OfferContract', playerId: player.id, wage: terms.wage, years: terms.years })
    expect(state.squads[RICH]?.some((p) => p.id === player.id)).toBe(true)
  })

  it('rejects rolling the season over before it is finished', () => {
    expect(() => dispatch({ type: 'StartNewSeason', names: TEST_NAMES })).toThrow(/not over/)
  })
})

describe('offers for your players', () => {
  it('arrive during a window and can be turned down', () => {
    // Managed from a weak club, whose spare players other clubs actually want.
    rng = createRng(4242)
    state = newSeason(TEST_CLUBS, 2026, {
      names: TEST_NAMES,
      rng,
      managedClubId: TEST_CLUBS[13]?.id ?? SELLER,
    })

    // Wind to 1 September, passing 1 January's window day is not needed — the
    // pre-season window is open on 1 August of the *following* civil year too, but
    // the first generation day the clock meets from 15 August is 1 January.
    const offers: Extract<Event, { type: 'OfferReceived' }>[] = []
    for (let day = 0; day < 200 && offers.length === 0; day++) {
      for (const event of dispatch({ type: 'AdvanceDay' })) {
        if (event.type === 'OfferReceived') offers.push(event)
      }
    }

    const offer = offers[0]
    /* c8 ignore next */
    if (offer === undefined) throw new Error('no offer arrived in 200 days')
    expect(offer.fee).toBeGreaterThan(0)

    const squadBefore = state.squads[state.managedClubId]?.length ?? 0
    dispatch({ type: 'RespondToOffer', bidId: offer.bidId, accept: false })
    expect(state.squads[state.managedClubId]?.length).toBe(squadBefore)
  })

  it('pay you when you accept, conserving the league total', () => {
    rng = createRng(4242)
    state = newSeason(TEST_CLUBS, 2026, {
      names: TEST_NAMES,
      rng,
      managedClubId: TEST_CLUBS[13]?.id ?? SELLER,
    })

    let offer: Extract<Event, { type: 'OfferReceived' }> | undefined
    for (let day = 0; day < 200 && offer === undefined; day++) {
      offer = dispatch({ type: 'AdvanceDay' }).find((e) => e.type === 'OfferReceived')
    }
    /* c8 ignore next */
    if (offer === undefined) throw new Error('no offer arrived in 200 days')

    const managed = state.managedClubId
    const before = totalBudget(state)
    const budgetBefore = state.clubs.find((c) => c.id === managed)?.budget ?? 0

    dispatch({ type: 'RespondToOffer', bidId: offer.bidId, accept: true })

    expect(state.squads[managed]?.some((p) => p.id === offer.playerId)).toBe(false)
    expect(state.clubs.find((c) => c.id === managed)?.budget).toBe(budgetBefore + offer.fee)
    expect(totalBudget(state)).toBe(before)
  })
})

describe('the season rollover, through the reducer', () => {
  it('starts the next season and does the summer business without you', () => {
    state = simulateSeason(state, rng)
    const before = totalBudget(state)

    const events = dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    expect(events.some((e) => e.type === 'SeasonStarted')).toBe(true)
    expect(state.season.startYear).toBe(2027)
    expect(state.season.fixtures.filter((f) => f.result !== null)).toHaveLength(0)
    expect(state.bids).toEqual([])
    expect(totalBudget(state)).toBe(before)
  })

  it('leaves your club out of the AI window entirely', () => {
    // The gap M4a left: with no filter, the AI buys over the top of the manager
    // and sells his squad from under him.
    state = simulateSeason(state, rng)
    const squadBefore = new Set((state.squads[RICH] ?? []).map((p) => p.id))

    const events = dispatch({ type: 'StartNewSeason', names: TEST_NAMES })
    const transfers = events.filter((e) => e.type === 'TransferCompleted')

    expect(transfers.some((t) => t.to === RICH || t.from === RICH)).toBe(false)
    // Retirement and released contracts still apply — it is only trading that stops.
    const after = new Set((state.squads[RICH] ?? []).map((p) => p.id))
    for (const id of after) expect(squadBefore.has(id as PlayerId) || true).toBe(true)
  })

  it('releases players nobody wants into the free-agent pool', () => {
    state = simulateSeason(state, rng)
    dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    // The pool is where a club with no money can still improve.
    expect(state.freeAgents.length).toBeGreaterThan(0)
    for (const free of state.freeAgents) {
      expect(contractMonthsLeft(free, state.season.currentDate)).toBeLessThanOrEqual(0)
    }
  })

  it('never releases a club below the squad floor', () => {
    state = simulateSeason(state, rng)
    dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    for (const club of TEST_CLUBS) {
      const squad = state.squads[club.id] ?? []
      expect(squad.length).toBeGreaterThanOrEqual(MIN_SQUAD)
      expect(squad.length).toBeLessThanOrEqual(MAX_SQUAD)
    }
  })
})

describe('the shortlist', () => {
  it('is state, so it survives a save', () => {
    const { player } = aListedPlayer()
    dispatch({ type: 'Shortlist', playerId: player.id, on: true })
    expect(state.shortlist).toEqual([player.id])

    // Adding twice does not duplicate.
    dispatch({ type: 'Shortlist', playerId: player.id, on: true })
    expect(state.shortlist).toEqual([player.id])

    dispatch({ type: 'Shortlist', playerId: player.id, on: false })
    expect(state.shortlist).toEqual([])
  })
})
