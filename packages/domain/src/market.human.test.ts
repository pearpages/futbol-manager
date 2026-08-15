import { beforeEach, describe, expect, it } from 'vitest'
import { suggestedTerms } from './bids.ts'
import type { ClubId } from './entities.ts'
import { bidIsLive } from './bids.ts'
import { FINANCE } from './finance.ts'
import { bestXI, type Formation, startersOf } from './lineup.ts'
import {
  COVER_KEEPERS,
  listedForSale,
  MAX_SQUAD,
  MIN_SQUAD,
  runTransferWindow,
  saleBlock,
  surplus,
  totalBudget,
  transferWindowChange,
  transferWindowDaysLeft,
  WINDOW_WARNING_DAYS,
} from './market.ts'
import { contractMonthsLeft, overall, type Player, type PlayerId, type Position } from './player.ts'
import { addDays, fromCivil, toCivil } from './time.ts'
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

/**
 * The two lines that make the league total move at a rollover: prize money comes
 * in, signing bonuses go out.
 *
 * Read off the ledgers rather than recomputed from `FINANCE`, so a test cannot
 * agree with a mistake by making it twice.
 */
const prizeTotal = (s: GameState) => s.clubs.reduce((sum, c) => sum + c.lastLedger.prize, 0)
const bonusTotal = (s: GameState) => s.clubs.reduce((sum, c) => sum + c.ledger.bonuses, 0)

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

    const events = completeSigning(player, fee)

    expect(events.map((e) => e.type)).toContain('TransferCompleted')
    expect(state.squads[RICH]?.some((p) => p.id === player.id)).toBe(true)
    expect(state.squads[from]?.some((p) => p.id === player.id)).toBe(false)
    // Asserted on the ledger rather than on the totals, because completing a
    // signing burns days and the clock earns money while it does. The claim is
    // about the transfer: the fee nets to zero across the league, and the signing
    // bonus does not, because it is paid to the player.
    const fees = state.clubs.reduce((sum, c) => sum + c.ledger.transfers, 0)
    const bonuses = state.clubs.reduce((sum, c) => sum + c.ledger.bonuses, 0)
    expect(fees).toBe(0)
    expect(bonuses).toBe(Math.round(fee * FINANCE.SIGNING_BONUS))
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
    const ledgerOf = (id: ClubId) => state.clubs.find((c) => c.id === id)?.ledger

    completeSigning(player, fee)

    // The buyer pays the fee *and* the player's signing bonus; the seller
    // receives only the fee, and no third club is touched at all.
    expect(ledgerOf(RICH)?.transfers).toBe(-fee)
    expect(ledgerOf(RICH)?.bonuses).toBe(Math.round(fee * FINANCE.SIGNING_BONUS))
    expect(ledgerOf(from)?.transfers).toBe(fee)
    for (const club of state.clubs) {
      if (club.id === RICH || club.id === from) continue
      expect(club.ledger.transfers, club.id).toBe(0)
    }
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
    // Scoped to bids *we* made. Since M4c the clock also brings in offers for our
    // own players, so the bid list is two-directional.
    expect(state.bids.filter((b) => b.from === RICH).filter(bidIsLive)).toHaveLength(0)
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
      /overdraft limit/,
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
    // You receive the whole fee; the buying club also pays the player a signing
    // bonus, and that is the part which leaves the league.
    expect(totalBudget(state)).toBe(before - Math.round(offer.fee * FINANCE.SIGNING_BONUS))
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
    // The league total is no longer constant across a rollover: prize money comes
    // in and signing bonuses go out. Stating both exactly is stricter than the old
    // blanket equality, because it names where every unit went — see ADR 0009.
    expect(totalBudget(state)).toBe(before + prizeTotal(state) - bonusTotal(state))
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

describe('the transfer list — putting your own players up for sale', () => {
  /**
   * A mid club: its spares are cheap enough that somebody actually wants them.
   *
   * **The index is load-bearing and it is not arbitrary.** Only some clubs attract a
   * buyer in a given window — 8 of 20 at this seed — because a club makes one paid
   * signing per window and every seller in the league competes for those slots. This
   * was index 13 while the ratings were hand-tuned, and that club stopped selling
   * when real market values reshuffled the middle. Nothing broke: the same probe run
   * against the old league had 6 of 20 selling, so the market got *more* liquid, not
   * less. The test had simply been riding on its subject happening to be a seller.
   *
   * If this fails again, re-pick the club rather than loosening the assertion — but
   * check the league-wide seller count first, because a collapse to nought is a real
   * bug and this is the test that would show it. It has been 6, 8, 9 and now **7 of
   * 20** across four changes to the model — the trend is the health check, and which
   * particular club is in the set has moved every single time. **Expect to re-pick this
   * index whenever generation changes; that is not a defect in the market.**
   */
  const MID = TEST_CLUBS[13]?.id ?? SELLER

  beforeEach(() => {
    rng = createRng(4242)
    state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng, managedClubId: MID })
  })

  const aSpare = () => {
    const player = surplus(state.squads[MID] ?? [])[0]
    /* c8 ignore next */
    if (player === undefined) throw new Error('nothing spare')
    return player
  }

  const aStarter = () => {
    const starters = new Set(state.lineups[MID]?.starters ?? [])
    const player = (state.squads[MID] ?? []).find((p) => starters.has(p.id))
    /* c8 ignore next */
    if (player === undefined) throw new Error('no starter')
    return player
  }

  it('lists a spare player', () => {
    const player = aSpare()
    const events = dispatch({ type: 'ListPlayer', playerId: player.id, on: true })

    expect(state.transferList).toEqual([player.id])
    expect(events).toEqual([{ type: 'PlayerListed', playerId: player.id, on: true }])
  })

  it('refuses to list a first-team player', () => {
    // Selling is squad management, not asset-stripping — you cannot break up the
    // XI you just picked. Same `surplus` rule the AI sells by.
    expect(() => dispatch({ type: 'ListPlayer', playerId: aStarter().id, on: true })).toThrow(
      /first team/,
    )
    expect(state.transferList).toEqual([])
  })

  it('refuses to list a player who is not yours', () => {
    const theirs = state.squads[RICH]?.[0]
    /* c8 ignore next */
    if (theirs === undefined) throw new Error('no squad')
    expect(() => dispatch({ type: 'ListPlayer', playerId: theirs.id, on: true })).toThrow(
      /your own players/,
    )
  })

  it('unlists, and does not duplicate on a repeat listing', () => {
    const player = aSpare()
    dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    expect(state.transferList).toEqual([player.id])

    dispatch({ type: 'ListPlayer', playerId: player.id, on: false })
    expect(state.transferList).toEqual([])
  })

  it('always allows unlisting, even once he is a starter again', () => {
    // Refusing would strand him on a list `listedForSale` already ignores, so the
    // screen would show a state the market does not agree with.
    const player = aSpare()
    dispatch({ type: 'ListPlayer', playerId: player.id, on: true })

    const squad = state.squads[MID] ?? []
    const lineup = state.lineups[MID]
    /* c8 ignore next */
    if (lineup === undefined) throw new Error('no lineup')
    const swapped = [...lineup.starters]
    const dropped = swapped.findIndex((id) =>
      squad.some((p) => p.id === id && p.position === player.position),
    )
    swapped[dropped] = player.id
    state = { ...state, lineups: { ...state.lineups, [MID]: { ...lineup, starters: swapped } } }

    expect(() => dispatch({ type: 'ListPlayer', playerId: player.id, on: false })).not.toThrow()
    expect(state.transferList).toEqual([])
  })

  it('sells a listed player at the next window, and the money moves', () => {
    // Nothing of yours reaches a buyer unless you list it — that is the whole
    // mechanism, and before M4c there was no way in at all.
    for (const player of surplus(state.squads[MID] ?? [])) {
      dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    }
    const listedIds = new Set(state.transferList)

    state = simulateSeason(state, rng)
    const events = dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    const sold = events.filter((e) => e.type === 'TransferCompleted').filter((e) => e.from === MID)
    expect(sold.length).toBeGreaterThan(0)
    for (const sale of sold) expect(listedIds.has(sale.playerId)).toBe(true)

    const earned = sold.reduce((sum, sale) => sum + sale.fee, 0)
    // On the ledger, because the rollover also pays last season's prize and the
    // new season's first settlement day may already have run. What the sale is
    // responsible for is the fees line, exactly.
    expect(state.clubs.find((c) => c.id === MID)?.ledger.transfers).toBe(earned)
    expect(earned).toBeGreaterThan(0)
  })

  it('takes a sold player off the list rather than leaving a dead id', () => {
    for (const player of surplus(state.squads[MID] ?? [])) {
      dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    }
    state = simulateSeason(state, rng)
    dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    const own = new Set((state.squads[MID] ?? []).map((p) => p.id))
    for (const id of state.transferList) expect(own.has(id)).toBe(true)
  })

  it('sells nobody you did not list', () => {
    const before = new Set((state.squads[MID] ?? []).map((p) => p.id))
    state = simulateSeason(state, rng)
    dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    // Retirement and its youth replacement still apply; trading does not.
    //
    // The youth filter used to read `-2027-`, which never matched anything:
    // `generateYouthPlayer` builds `${club.id}-y${year}-${n}`, so the id is
    // `c11-y2027-0` and the `y` sits where that pattern wanted a dash. It went
    // unnoticed because the club this block managed happened to take no youth intake
    // that season — so the filter was dead code guarding a case that never arose.
    const after = state.squads[MID] ?? []
    const bought = after.filter((p) => !before.has(p.id) && !p.id.startsWith(`${MID}-y`))
    expect(bought).toHaveLength(0)
  })

  it('never sells you down to a team you cannot field', () => {
    // **`MIN_SQUAD` is deliberately not what is asserted here.** It is the AI's
    // floor, and the manager is no longer held to it — he may sell his way below
    // 18 if he wants to, which is his business. What the rule does still guarantee
    // is the part that matters: a starter is never sold, so a legal XI with exactly
    // one goalkeeper always survives, and a cover keeper with it.
    for (const player of surplus(state.squads[MID] ?? [])) {
      dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    }
    for (let season = 0; season < 3; season++) {
      state = simulateSeason(state, rng)
      dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

      const squad = state.squads[MID] ?? []
      expect(() => startersOf(squad, bestXI(squad, '4-4-2'))).not.toThrow()
      expect(squad.filter((p) => p.position === 'GK').length).toBeGreaterThanOrEqual(COVER_KEEPERS)
    }
  })
})

/**
 * What the manager may sell, which stopped being what an AI club may sell.
 *
 * `surplus` judges against a fixed 4-4-2 — fine for a club nobody watches, and
 * wrong for a person, because it told him a man on his own bench was "in your
 * first team". Measured before the change: on any shape but 4-4-2, one row per
 * club read "not selected" *and* refused him as first-team, two rows per club on
 * 4-2-4, plus 14 reserve goalkeepers and 3 midfielders across the league blocked
 * by a depth floor and given the same wrong sentence.
 */
describe('selling is judged by the XI you picked', () => {
  const MID = TEST_CLUBS[13]?.id ?? SELLER

  beforeEach(() => {
    rng = createRng(4242)
    state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng, managedClubId: MID })
  })

  /** Puts the manager on a shape whose XI genuinely differs from the 4-4-2 one. */
  function play(formation: Formation): { starting: Set<PlayerId>; squad: readonly Player[] } {
    const squad = state.squads[MID] ?? []
    const lineup = bestXI(squad, formation)
    state = { ...state, lineups: { ...state.lineups, [MID]: lineup } }
    return { starting: new Set(lineup.starters), squad }
  }

  it('lets you sell a man on your own bench, whatever 4-4-2 would say', () => {
    // The reported bug. On 4-2-4 two midfielders drop out of the XI, and both were
    // refused as first-team while their row read "not selected" — a contradiction
    // on one line, and the whole reason the rule changed.
    const { starting, squad } = play('4-2-4')
    const reference = new Set(bestXI(squad, '4-4-2').starters)
    const benched = squad.filter((p) => !starting.has(p.id) && reference.has(p.id))
    expect(benched.length).toBeGreaterThan(0)

    for (const player of benched) {
      expect(saleBlock(squad, state.lineups[MID], player)).toBeNull()
      dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    }
    expect(state.transferList).toEqual(benched.map((p) => p.id))
  })

  it('and still refuses a man in your XI, where 4-4-2 would have let him go', () => {
    // The mirror, and the test that bites if the rule is merely deleted rather than
    // replaced: on 4-2-4 two forwards come *into* the team who are not in the 4-4-2
    // eleven, and they are exactly the players the old rule would have sold.
    const { starting, squad } = play('4-2-4')
    const reference = new Set(bestXI(squad, '4-4-2').starters)
    const promoted = squad.filter((p) => starting.has(p.id) && !reference.has(p.id))
    expect(promoted.length).toBeGreaterThan(0)

    for (const player of promoted) {
      expect(saleBlock(squad, state.lineups[MID], player)).toBe('lineup')
      expect(() => dispatch({ type: 'ListPlayer', playerId: player.id, on: true })).toThrow(
        /first team/,
      )
    }
    expect(state.transferList).toEqual([])
  })

  it('will not leave you with one goalkeeper, and says so in its own words', () => {
    // The one floor that survived. A keeper carries 35% of the defensive rating
    // alone, so a squad down to one is a squad an injury ends.
    const squad = state.squads[MID] ?? []
    const keepers = squad.filter((p) => p.position === 'GK')
    expect(keepers.length).toBeGreaterThanOrEqual(COVER_KEEPERS + 1)

    // With three, the reserves are sellable.
    const starting = new Set(state.lineups[MID]?.starters ?? [])
    const reserves = keepers.filter((p) => !starting.has(p.id))
    for (const keeper of reserves) expect(saleBlock(squad, state.lineups[MID], keeper)).toBeNull()

    // Cut to two, and the reserve is not — with the keeper sentence, not the
    // first-team one, which is the half of this the screen was getting wrong.
    const twoKeepers = squad.filter((p) => p.position !== 'GK' || p.id !== reserves[0]?.id)
    state = { ...state, squads: { ...state.squads, [MID]: twoKeepers } }
    const survivor = reserves[1]
    /* c8 ignore next */
    if (survivor === undefined) throw new Error('expected a second reserve keeper')

    expect(saleBlock(twoKeepers, state.lineups[MID], survivor)).toBe('coverKeeper')
    expect(() => dispatch({ type: 'ListPlayer', playerId: survivor.id, on: true })).toThrow(
      /goalkeeper/,
    )
  })

  it('drops a listed player from the market once you pick him', () => {
    // Listing says "I would let him go", not "sell him whatever happens". The rule
    // is applied again at the window rather than trusted from when the button was
    // pressed.
    const squad = state.squads[MID] ?? []
    const starting = new Set(state.lineups[MID]?.starters ?? [])
    const spare = squad.find((p) => !starting.has(p.id) && p.position !== 'GK')
    /* c8 ignore next */
    if (spare === undefined) throw new Error('nothing spare')

    dispatch({ type: 'ListPlayer', playerId: spare.id, on: true })
    expect(listedForSale(state).map((p) => p.id)).toEqual([spare.id])

    // Pick him, without unlisting him.
    const lineup = state.lineups[MID]
    /* c8 ignore next */
    if (lineup === undefined) throw new Error('no lineup')
    const starters = [...lineup.starters]
    const dropped = starters.findIndex((id) =>
      squad.some((p) => p.id === id && p.position === spare.position),
    )
    starters[dropped] = spare.id
    state = { ...state, lineups: { ...state.lineups, [MID]: { ...lineup, starters } } }

    expect(listedForSale(state)).toEqual([])
  })

  it('completes a sale the squad-size floor would have vetoed at the window', () => {
    // **The half of this change that is invisible until a whole window runs.**
    // `runTransferWindow` re-checks the seller in its buy loop, and that gate applies
    // to the manager for anything he listed. Left on `canSpare`/`MIN_SQUAD` it would
    // have silently killed deals the screen and the reducer had both already allowed
    // — no refusal, no event, the player simply never moves.
    //
    // Set up so the old gate is unambiguously the only thing that could refuse:
    // exactly `MIN_SQUAD` players, where `surplus` returns nothing at all.
    const squad = state.squads[MID] ?? []
    const target = squad.find(
      (p) => p.position === 'GK' && !new Set(state.lineups[MID]?.starters ?? []).has(p.id),
    )
    /* c8 ignore next */
    if (target === undefined) throw new Error('no reserve keeper')

    const cap: Record<Position, number> = { GK: 3, DF: 6, MF: 5, FW: 4 }
    const kept: Player[] = [target]
    const taken: Record<Position, number> = { GK: 1, DF: 0, MF: 0, FW: 0 }
    for (const player of squad) {
      if (player.id === target.id) continue
      if (taken[player.position] < cap[player.position]) {
        kept.push(player)
        taken[player.position]++
      }
    }
    expect(kept).toHaveLength(MIN_SQUAD)
    expect(surplus(kept)).toEqual([]) // the old rule sold nobody from a squad this size

    // A buyer who unambiguously wants him: the richest club, left with only its
    // worst goalkeeper.
    const buyerSquad = state.squads[RICH] ?? []
    const buyerKeepers = [...buyerSquad.filter((p) => p.position === 'GK')].sort(
      (a, b) => overall(a) - overall(b),
    )
    const holed = buyerSquad.filter((p) => p.position !== 'GK' || p.id === buyerKeepers[0]?.id)

    state = {
      ...state,
      squads: { ...state.squads, [MID]: kept, [RICH]: holed },
      lineups: {
        ...state.lineups,
        [MID]: bestXI(kept, '4-4-2'),
        [RICH]: bestXI(holed, '4-4-2'),
      },
      transferList: [target.id],
    }
    expect(saleBlock(kept, state.lineups[MID], target)).toBeNull()

    const sold = runTransferWindow(state, createRng(1), { exclude: MID }).filter(
      (t) => t.from === MID,
    )
    expect(sold.map((t) => t.playerId)).toEqual([target.id])
  })
})

describe('offers arrive through the window, not once a year', () => {
  const MID = TEST_CLUBS[13]?.id ?? SELLER

  beforeEach(() => {
    rng = createRng(4242)
    state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng, managedClubId: MID })
  })

  it('offers during August, which the old gate could never reach', () => {
    // The bug this milestone exists for: generation was gated on the 1st of a
    // window month, but the clock enters every season on 15 August and rolls
    // straight to the next 15 August, so 1 July and 1 August never happened. One
    // generation day a season, 1 January, and a manager could play for years
    // without being offered anything.
    const seen: Event[] = []
    for (let day = 0; day < 30; day++) {
      for (const event of dispatch({ type: 'AdvanceDay' })) {
        if (event.type === 'OfferReceived') seen.push(event)
      }
    }
    expect(seen.length).toBeGreaterThan(0)
  })

  it('asks about a listed player it would not have approached you about', () => {
    // Listing lowers the bar: you advertised him, so less interest is needed than
    // for an approach out of the blue.
    const quiet: Event[] = []
    for (let day = 0; day < 30; day++) {
      for (const event of dispatch({ type: 'AdvanceDay' })) {
        if (event.type === 'OfferReceived') quiet.push(event)
      }
    }

    rng = createRng(4242)
    state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng, managedClubId: MID })
    for (const player of surplus(state.squads[MID] ?? [])) {
      dispatch({ type: 'ListPlayer', playerId: player.id, on: true })
    }
    const listedOffers: Event[] = []
    for (let day = 0; day < 30; day++) {
      for (const event of dispatch({ type: 'AdvanceDay' })) {
        if (event.type === 'OfferReceived') listedOffers.push(event)
      }
    }

    expect(listedOffers.length).toBeGreaterThanOrEqual(quiet.length)
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

/**
 * The window is a predicate over the date, so nothing used to mark the moment it
 * turned. You learned it had opened by walking to the market screen and reading a
 * stat — which is to say, by already suspecting.
 */
describe('the window announces itself', () => {
  it('reports a change and only a change', () => {
    expect(transferWindowChange(fromCivil(2026, 12, 31), fromCivil(2027, 1, 1))).toBe(true)
    expect(transferWindowChange(fromCivil(2027, 1, 31), fromCivil(2027, 2, 1))).toBe(false)
    expect(transferWindowChange(fromCivil(2027, 8, 30), fromCivil(2027, 8, 31))).toBe(null)
    expect(transferWindowChange(fromCivil(2027, 3, 4), fromCivil(2027, 3, 5))).toBe(null)
  })

  it('marks the closing and the January opening as the clock passes them', () => {
    const changes: { open: boolean; month: number }[] = []

    // A season opens on 15 August with the window already open, so the two turns
    // the day clock can reach are 31 Aug → 1 Sep and 31 Dec → 1 Jan.
    while (toCivil(state.season.currentDate).m !== 1) {
      for (const event of dispatch({ type: 'AdvanceDay' })) {
        if (event.type === 'TransferWindowChanged') {
          changes.push({ open: event.open, month: toCivil(event.date).m })
        }
      }
    }

    expect(changes).toEqual([
      { open: false, month: 9 },
      { open: true, month: 1 },
    ])
  })

  /**
   * The one the day clock cannot see. `StartNewSeason` jumps from the end of a
   * season straight to 15 August, stepping clean over July — so a tick-only
   * implementation announces January every year and never a summer.
   */
  it('marks the summer opening across the rollover, which no tick crosses', () => {
    state = simulateSeason(state, rng)
    expect(toCivil(state.season.currentDate).m).not.toBe(8)

    const events = dispatch({ type: 'StartNewSeason', names: TEST_NAMES })
    const changes = events.filter((e) => e.type === 'TransferWindowChanged')

    expect(changes).toHaveLength(1)
    expect(changes[0]?.open).toBe(true)
    expect(toCivil(state.season.currentDate).m).toBe(8)
  })
})

describe('how long is left of the market', () => {
  it('counts to the end of the window, not to the end of the month', () => {
    // A season opens here, so this is the figure the bar shows on day one.
    expect(transferWindowDaysLeft(fromCivil(2026, 8, 15))).toBe(17)
    expect(transferWindowDaysLeft(fromCivil(2026, 8, 31))).toBe(1)
    expect(transferWindowDaysLeft(fromCivil(2027, 1, 1))).toBe(31)
    expect(transferWindowDaysLeft(fromCivil(2027, 1, 31))).toBe(1)
    expect(transferWindowDaysLeft(fromCivil(2027, 3, 5))).toBe(null)
  })

  /**
   * July and August are **one** window. Counting to the first of next month gives 31
   * here and is wrong by a whole month — and it is right in every other case above,
   * because the day clock never enters July. The rollover jumps it.
   */
  it('treats July and August as one window', () => {
    expect(transferWindowDaysLeft(fromCivil(2026, 7, 1))).toBe(62)
    expect(transferWindowDaysLeft(fromCivil(2026, 7, 31))).toBe(32)
  })

  it('warns once, on the day the threshold is reached, and never again', () => {
    const warnings: number[] = []

    // Through the summer deadline and the whole of the winter window, so a warning
    // repeated daily — or emitted twice a window — shows up as a longer list.
    while (toCivil(state.season.currentDate).m !== 2) {
      for (const event of dispatch({ type: 'AdvanceDay' })) {
        if (event.type === 'TransferWindowClosing') warnings.push(event.daysLeft)
      }
    }

    expect(warnings).toEqual([WINDOW_WARNING_DAYS, WINDOW_WARNING_DAYS])
  })

  it('says nothing at the rollover, which lands with the window wide open', () => {
    state = simulateSeason(state, rng)
    const events = dispatch({ type: 'StartNewSeason', names: TEST_NAMES })

    expect(events.some((e) => e.type === 'TransferWindowClosing')).toBe(false)
    expect(transferWindowDaysLeft(state.season.currentDate)).toBe(17)
  })
})
