import {
  answerBid,
  type Bid,
  type BidId,
  bidIsLive,
  type BidStatus,
  MAX_CONTRACT_YEARS,
  MIN_CONTRACT_YEARS,
  offerTerms,
  OFFER_LIFETIME_DAYS,
  scheduleAnswer,
} from './bids.ts'
import {
  type Club,
  type ClubId,
  type Fixture,
  type FixtureId,
  type Score,
  type TeamRating,
} from './entities.ts'
import { judge } from './board.ts'
import {
  canAfford,
  credit,
  expansionCost,
  FINANCE,
  gateReceipts,
  isSettlementDay,
  ledgerNet,
  monthlyLines,
  positionsFrom,
} from './finance.ts'
import { ROUNDS_PER_HALF } from './fixtures.ts'
import { BALANCED, type Lineup, startersOf, type Tactics, teamRating } from './lineup.ts'
import {
  applyTransfers,
  isTransferWindowOpen,
  MAX_SQUAD,
  needFor,
  runTransferWindow,
  surplus,
} from './market.ts'
import { contractExpiry, type Player, type PlayerId } from './player.ts'
import { resolveFixture } from './resolve.ts'
import type { Rng } from './rng.ts'
import { rolloverSeason } from './season.ts'
import { type GameState, isSeasonComplete } from './state.ts'
import { addDays, type DayNumber, dayOfWeek } from './time.ts'
import { askingPrice } from './valuation.ts'

/**
 * The only way state changes — ground rule 2.
 *
 * `reduce` is pure: it takes state, a command and an rng, and returns new state
 * plus the events that describe what happened. It never mutates its input and
 * never reads a clock. The UI dispatches commands and renders from events; the
 * statistical harness drives the exact same door, which is the point — a
 * regression net only covers what it actually exercises.
 *
 * M6 grows the `AdvanceDay` handler into the day pipeline the roadmap sketches — `[ageAndContracts, injuries, training, morale, aiTransfers,
 * playMatches, finances]` — by inserting pure functions in front of the existing
 * match resolution, not by restructuring this.
 */

export interface AdvanceDay {
  readonly type: 'AdvanceDay'
}

/** Rejected if the XI is illegal, so an invalid lineup can never reach a match. */
export interface SetLineup {
  readonly type: 'SetLineup'
  readonly clubId: ClubId
  readonly lineup: Lineup
}

export interface SetTactics {
  readonly type: 'SetTactics'
  readonly clubId: ClubId
  readonly tactics: Tactics
}

/**
 * Roll into the next season. Until M4b there was no way to reach one from the UI
 * at all — `rolloverSeason` existed but only the headless career driver called it,
 * so the app showed "Season over" and stayed there forever.
 */
export interface StartNewSeason {
  readonly type: 'StartNewSeason'
  /**
   * Name pool for the youngsters who replace retirees. Carried on the command
   * because `domain` owns no word lists — ground rule 1 — exactly as `newSeason`
   * takes one.
   */
  readonly names: readonly string[]
}

/** An offer for a player another club has listed. Rejected if he is not for sale. */
export interface MakeBid {
  readonly type: 'MakeBid'
  readonly playerId: PlayerId
  readonly fee: number
}

export interface WithdrawBid {
  readonly type: 'WithdrawBid'
  readonly bidId: BidId
}

/** Personal terms — the second half of a transfer, and a separate refusal. */
export interface OfferContract {
  readonly type: 'OfferContract'
  readonly playerId: PlayerId
  readonly wage: number
  readonly years: number
}

/** Answer an AI club's offer for one of your players. */
export interface RespondToOffer {
  readonly type: 'RespondToOffer'
  readonly bidId: BidId
  readonly accept: boolean
}

export interface Shortlist {
  readonly type: 'Shortlist'
  readonly playerId: PlayerId
  readonly on: boolean
}

/**
 * Put one of your own players up for sale, or take him off the market.
 *
 * Your club is invisible to the AI market by default. This is how you opt a
 * single player back into it — the only way anything of yours is ever offered to
 * anyone.
 */
export interface ListPlayer {
  readonly type: 'ListPlayer'
  readonly playerId: PlayerId
  readonly on: boolean
}

/**
 * What a seat costs at your ground. Managed club only — the AI charges the
 * league default and never touches it.
 */
export interface SetTicketPrice {
  readonly type: 'SetTicketPrice'
  readonly price: number
}

/**
 * Buy seats. Paid for now, delivered at the rollover.
 *
 * The delay is the decision: you commit the money a season before you find out
 * whether you needed the room.
 */
export interface StartExpansion {
  readonly type: 'StartExpansion'
  readonly seats: number
}

export type Command =
  | AdvanceDay
  | SetLineup
  | SetTactics
  | StartNewSeason
  | MakeBid
  | WithdrawBid
  | OfferContract
  | RespondToOffer
  | Shortlist
  | ListPlayer
  | SetTicketPrice
  | StartExpansion

export interface MatchPlayed {
  readonly type: 'MatchPlayed'
  readonly fixtureId: FixtureId
  readonly round: number
  readonly homeId: ClubId
  readonly awayId: ClubId
  readonly score: Score
}

export interface DayAdvanced {
  readonly type: 'DayAdvanced'
  readonly date: DayNumber
}

export interface SeasonEnded {
  readonly type: 'SeasonEnded'
  readonly startYear: number
}

export interface LineupChanged {
  readonly type: 'LineupChanged'
  readonly clubId: ClubId
}

export interface TacticsChanged {
  readonly type: 'TacticsChanged'
  readonly clubId: ClubId
}

export interface SeasonStarted {
  readonly type: 'SeasonStarted'
  readonly startYear: number
}

export interface BidMade {
  readonly type: 'BidMade'
  readonly bidId: BidId
  readonly playerId: PlayerId
  readonly fee: number
}

/** The selling club's answer. `counterFee` is set only when they countered. */
export interface BidAnswered {
  readonly type: 'BidAnswered'
  readonly bidId: BidId
  readonly playerId: PlayerId
  readonly status: BidStatus
  readonly counterFee: number | null
}

/** An AI club wants one of yours. */
export interface OfferReceived {
  readonly type: 'OfferReceived'
  readonly bidId: BidId
  readonly playerId: PlayerId
  readonly from: ClubId
  readonly fee: number
}

/** Terms were put to a player and refused. `wanted` is what he would have signed for. */
export interface TermsRejected {
  readonly type: 'TermsRejected'
  readonly playerId: PlayerId
  readonly reason: 'wage' | 'length'
  readonly wanted: number
}

export interface PlayerListed {
  readonly type: 'PlayerListed'
  readonly playerId: PlayerId
  readonly on: boolean
}

export interface TransferCompleted {
  readonly type: 'TransferCompleted'
  readonly playerId: PlayerId
  readonly from: ClubId | null
  readonly to: ClubId
  readonly fee: number
}

/** The board's verdict on a finished season. */
export interface BoardVerdict {
  readonly type: 'BoardVerdict'
  readonly startYear: number
  readonly target: number
  readonly finish: number
  readonly met: boolean
  readonly strikes: number
  /** True on the season the job ends. */
  readonly dismissed: boolean
}

export interface TicketPriceSet {
  readonly type: 'TicketPriceSet'
  readonly price: number
}

export interface ExpansionStarted {
  readonly type: 'ExpansionStarted'
  readonly seats: number
  readonly cost: number
  readonly readyYear: number
}

/** The seats opened. Emitted at the rollover that delivers them. */
export interface ExpansionOpened {
  readonly type: 'ExpansionOpened'
  readonly seats: number
  readonly capacity: number
}

export type Event =
  | MatchPlayed
  | DayAdvanced
  | SeasonEnded
  | LineupChanged
  | TacticsChanged
  | SeasonStarted
  | BidMade
  | BidAnswered
  | OfferReceived
  | TermsRejected
  | PlayerListed
  | TransferCompleted
  | BoardVerdict
  | TicketPriceSet
  | ExpansionStarted
  | ExpansionOpened

export interface ReduceResult {
  readonly state: GameState
  readonly events: readonly Event[]
}

export function reduce(state: GameState, command: Command, rng: Rng): ReduceResult {
  switch (command.type) {
    case 'AdvanceDay':
      return advanceDay(state, rng)
    case 'SetLineup':
      return setLineup(state, command)
    case 'SetTactics':
      return setTactics(state, command)
    case 'StartNewSeason':
      return startNewSeason(state, command, rng)
    case 'MakeBid':
      return makeBid(state, command)
    case 'WithdrawBid':
      return withdrawBid(state, command)
    case 'OfferContract':
      return offerContract(state, command)
    case 'RespondToOffer':
      return respondToOffer(state, command)
    case 'Shortlist':
      return shortlist(state, command)
    case 'ListPlayer':
      return listPlayer(state, command)
    case 'SetTicketPrice':
      return setTicketPrice(state, command)
    case 'StartExpansion':
      return startExpansion(state, command)
  }
}

function setLineup(state: GameState, command: SetLineup): ReduceResult {
  // Validated here rather than in the UI. A screen can forget; the reducer is the
  // only way in, so an illegal XI cannot reach a matchday through any other route.
  startersOf(state.squads[command.clubId] ?? [], command.lineup)

  return {
    state: { ...state, lineups: { ...state.lineups, [command.clubId]: command.lineup } },
    events: [{ type: 'LineupChanged', clubId: command.clubId }],
  }
}

function setTactics(state: GameState, command: SetTactics): ReduceResult {
  const attacking = command.tactics.attacking
  if (!Number.isFinite(attacking) || attacking < 0 || attacking > 100) {
    throw new Error(`Tactics must sit between 0 and 100, got ${attacking}`)
  }

  return {
    state: { ...state, tactics: { ...state.tactics, [command.clubId]: command.tactics } },
    events: [{ type: 'TacticsChanged', clubId: command.clubId }],
  }
}

/**
 * Roll into next season, then do the summer's business.
 *
 * The AI window runs with the human's club excluded — this is the difference
 * between M4a, where nobody was playing, and a game where somebody is. Without it
 * the AI buys over the top of the manager and sells his squad from under him.
 */
function startNewSeason(state: GameState, command: StartNewSeason, rng: Rng): ReduceResult {
  if (!isSeasonComplete(state)) {
    throw new Error('The season is not over yet')
  }

  const rolled = rolloverSeason(state, rng, { names: command.names })
  const transfers = runTransferWindow(rolled, rng, { exclude: rolled.managedClubId })
  const next = applyTransfers(rolled, transfers)

  const events: Event[] = [{ type: 'SeasonStarted', startYear: next.season.startYear }]

  // Seats commissioned a season ago open now. Detected by comparing the ground
  // either side of the rollover rather than by re-deriving the rule, so there is
  // one place that decides when work is delivered.
  const before = state.clubs.find((c) => c.id === state.managedClubId)
  const after = next.clubs.find((c) => c.id === next.managedClubId)
  if (before !== undefined && after !== undefined && after.capacity > before.capacity) {
    events.push({
      type: 'ExpansionOpened',
      seats: after.capacity - before.capacity,
      capacity: after.capacity,
    })
  }

  for (const transfer of transfers) {
    events.push({
      type: 'TransferCompleted',
      playerId: transfer.playerId,
      from: transfer.from,
      to: transfer.to,
      fee: transfer.fee,
    })
  }

  // Last season's bids belong to last season. Anything unresolved is gone.
  return { state: { ...next, bids: [] }, events }
}

/** Locates a player anywhere in the league, and who holds him. */
function findPlayer(
  state: GameState,
  playerId: PlayerId,
): { player: Player; club: ClubId | null } | null {
  for (const club of state.clubs) {
    const player = (state.squads[club.id] ?? []).find((p) => p.id === playerId)
    if (player !== undefined) return { player, club: club.id }
  }
  const free = state.freeAgents.find((p) => p.id === playerId)
  return free === undefined ? null : { player: free, club: null }
}

function liveBidFor(state: GameState, playerId: PlayerId): Bid | undefined {
  return state.bids.find((bid) => bid.playerId === playerId && bidIsLive(bid))
}

/**
 * Validation lives here, not in the market screen — the same reasoning as
 * `SetLineup`. A screen can forget to disable a button; the reducer is the only
 * way in.
 */
function makeBid(state: GameState, command: MakeBid): ReduceResult {
  const date = state.season.currentDate
  const buyer = state.clubs.find((c) => c.id === state.managedClubId)
  /* c8 ignore next */
  if (buyer === undefined) throw new Error('No managed club')

  if (!isTransferWindowOpen(date)) throw new Error('The transfer window is closed')

  const found = findPlayer(state, command.playerId)
  if (found === null) throw new Error(`No such player: ${command.playerId}`)
  if (found.club === null) {
    throw new Error('A free agent costs no fee — offer him a contract instead')
  }
  if (found.club === state.managedClubId) throw new Error('He is already yours')

  // Only what the selling club has actually listed. `surplus` is the whole rule:
  // a club will not sell a player its XI depends on, at any price.
  const forSale = surplus(state.squads[found.club] ?? [])
  if (!forSale.some((p) => p.id === command.playerId)) {
    throw new Error(`${found.player.name} is not for sale`)
  }

  if (!Number.isFinite(command.fee) || command.fee <= 0) {
    throw new Error(`A bid must be a positive fee, got ${command.fee}`)
  }
  // Checked against the overdraft, not the balance: a manager may spend into
  // debt, which is the whole point of the limit existing. The AI may not — see
  // `runTransferWindow`.
  if (!affordable(state, buyer, command.fee)) {
    throw new Error('That would take you past your overdraft limit')
  }
  if ((state.squads[state.managedClubId] ?? []).length >= MAX_SQUAD) {
    throw new Error('Your squad is full')
  }
  if (liveBidFor(state, command.playerId) !== undefined) {
    throw new Error(`There is already a live bid for ${found.player.name}`)
  }

  const bid: Bid = {
    // Deterministic and unique: one live bid per player is enforced above, so the
    // player and the day it was made are enough. No rng — see bids.ts.
    id: `${command.playerId}-${date}` as BidId,
    playerId: command.playerId,
    from: state.managedClubId,
    to: found.club,
    fee: Math.round(command.fee),
    status: 'pending',
    counterFee: null,
    madeOn: date,
    answerOn: scheduleAnswer(date),
  }

  return {
    state: { ...state, bids: [...state.bids, bid] },
    events: [{ type: 'BidMade', bidId: bid.id, playerId: bid.playerId, fee: bid.fee }],
  }
}

function withdrawBid(state: GameState, command: WithdrawBid): ReduceResult {
  const bid = state.bids.find((b) => b.id === command.bidId)
  if (bid === undefined) throw new Error(`No such bid: ${command.bidId}`)
  if (bid.from !== state.managedClubId) throw new Error('That is not your bid')

  return {
    state: {
      ...state,
      bids: state.bids.map((b) => (b.id === command.bidId ? { ...b, status: 'withdrawn' } : b)),
    },
    events: [
      {
        type: 'BidAnswered',
        bidId: bid.id,
        playerId: bid.playerId,
        status: 'withdrawn',
        counterFee: null,
      },
    ],
  }
}

/**
 * Agree personal terms, which is what actually completes a signing.
 *
 * Two routes in: a bid the selling club accepted, or a free agent, who costs no
 * fee because there is nobody to pay.
 */
function offerContract(state: GameState, command: OfferContract): ReduceResult {
  const date = state.season.currentDate
  if (!isTransferWindowOpen(date)) throw new Error('The transfer window is closed')

  const found = findPlayer(state, command.playerId)
  if (found === null) throw new Error(`No such player: ${command.playerId}`)

  const bid = found.club === null ? undefined : liveBidFor(state, command.playerId)
  if (found.club !== null && (bid === undefined || bid.status !== 'accepted')) {
    throw new Error(`No agreed fee for ${found.player.name}`)
  }
  if (found.club === state.managedClubId) throw new Error('He is already yours')

  if (!Number.isInteger(command.years)) {
    throw new Error(`Contract length must be whole years, got ${command.years}`)
  }
  if (command.years < MIN_CONTRACT_YEARS || command.years > MAX_CONTRACT_YEARS) {
    throw new Error(
      `A contract runs ${MIN_CONTRACT_YEARS}–${MAX_CONTRACT_YEARS} years, got ${command.years}`,
    )
  }
  if (!Number.isFinite(command.wage) || command.wage < 0) {
    throw new Error(`A wage cannot be negative, got ${command.wage}`)
  }
  if ((state.squads[state.managedClubId] ?? []).length >= MAX_SQUAD) {
    throw new Error('Your squad is full')
  }

  const fee = bid?.fee ?? 0
  const buyer = state.clubs.find((c) => c.id === state.managedClubId)
  /* c8 ignore next */
  if (buyer === undefined) throw new Error('No managed club')
  if (!affordable(state, buyer, fee)) {
    throw new Error('That would take you past your overdraft limit')
  }

  const verdict = offerTerms(found.player, { wage: command.wage, years: command.years }, date)
  if (!verdict.accepted) {
    // A refusal is an outcome, not a mistake — the bid stays live so the terms can
    // be improved. Only a validation failure throws.
    return {
      state,
      events: [
        {
          type: 'TermsRejected',
          playerId: command.playerId,
          reason: verdict.reason === 'agreed' ? 'wage' : verdict.reason,
          wanted: verdict.wanted,
        },
      ],
    }
  }

  const moved = applyTransfers(state, [
    { playerId: command.playerId, from: found.club, to: state.managedClubId, fee },
  ])

  // The agreed terms replace whatever he was on — including the placeholder deal
  // `applyTransfers` hands a free agent, which exists for AI signings.
  const contract = {
    until: contractExpiry(moved.season.startYear + command.years),
    wage: Math.round(command.wage),
  }
  const squad = (moved.squads[state.managedClubId] ?? []).map((player) =>
    player.id === command.playerId ? { ...player, contract } : player,
  )

  return {
    state: {
      ...moved,
      squads: { ...moved.squads, [state.managedClubId]: squad },
      bids: moved.bids.filter((b) => b.id !== bid?.id),
    },
    events: [
      {
        type: 'TransferCompleted',
        playerId: command.playerId,
        from: found.club,
        to: state.managedClubId,
        fee,
      },
    ],
  }
}

/** Accept or reject an AI club's offer for one of yours. */
function respondToOffer(state: GameState, command: RespondToOffer): ReduceResult {
  const bid = state.bids.find((b) => b.id === command.bidId)
  if (bid === undefined) throw new Error(`No such bid: ${command.bidId}`)
  if (bid.to !== state.managedClubId) throw new Error('That offer is not yours to answer')
  if (!bidIsLive(bid)) throw new Error('That offer has already been settled')

  const bids = state.bids.filter((b) => b.id !== command.bidId)

  if (!command.accept) {
    return {
      state: { ...state, bids: [...bids, { ...bid, status: 'rejected' as const }] },
      events: [
        {
          type: 'BidAnswered',
          bidId: bid.id,
          playerId: bid.playerId,
          status: 'rejected',
          counterFee: null,
        },
      ],
    }
  }

  // Re-checked at acceptance rather than trusted from when the offer was made:
  // the squad may have shrunk in between, and selling below the floor would leave
  // a team unable to field an XI.
  const squad = state.squads[state.managedClubId] ?? []
  if (!surplus(squad).some((p) => p.id === bid.playerId)) {
    throw new Error('You can no longer spare him')
  }

  const moved = applyTransfers(state, [
    { playerId: bid.playerId, from: state.managedClubId, to: bid.from, fee: bid.fee },
  ])

  return {
    state: { ...moved, bids: [...bids, { ...bid, status: 'accepted' as const }] },
    events: [
      {
        type: 'TransferCompleted',
        playerId: bid.playerId,
        from: state.managedClubId,
        to: bid.from,
        fee: bid.fee,
      },
    ],
  }
}

/**
 * List or unlist one of your own players.
 *
 * Only a spare player can be listed, using the same `surplus` rule that decides
 * what an AI club will part with — there is deliberately not a second notion of
 * "spare" for the human. Selling stays squad management: you cannot strip out the
 * XI you just picked.
 *
 * Unlisting is always allowed. A player who has become a starter since he was
 * listed must still be removable, and refusing that would strand him on the list
 * — where `listedForSale` would ignore him anyway, so the screen would show a
 * state the market did not agree with.
 */
function listPlayer(state: GameState, command: ListPlayer): ReduceResult {
  const squad = state.squads[state.managedClubId] ?? []
  const without = state.transferList.filter((id) => id !== command.playerId)

  if (!command.on) {
    return {
      state: { ...state, transferList: without },
      events: [{ type: 'PlayerListed', playerId: command.playerId, on: false }],
    }
  }

  const player = squad.find((p) => p.id === command.playerId)
  if (player === undefined) throw new Error('You can only list your own players')
  if (!surplus(squad).some((p) => p.id === command.playerId)) {
    throw new Error(`${player.name} is in your first team — you cannot list him`)
  }

  return {
    state: { ...state, transferList: [...without, command.playerId] },
    events: [{ type: 'PlayerListed', playerId: command.playerId, on: true }],
  }
}

function shortlist(state: GameState, command: Shortlist): ReduceResult {
  const without = state.shortlist.filter((id) => id !== command.playerId)
  return {
    state: { ...state, shortlist: command.on ? [...without, command.playerId] : without },
    events: [],
  }
}

/**
 * The market's day tick: answers that are due, offers that arrive, offers that
 * lapse.
 *
 * **Draws no randomness, deliberately.** This runs inside `AdvanceDay`, which is
 * the path every calibrated distribution band in the project is measured through
 * — `simulateSeasons → simulateSeason → reduce(AdvanceDay)`. One `rng.next()`
 * here shifts every downstream draw and moves every band. See the note at the top
 * of `bids.ts`.
 */
function tickMarket(state: GameState, today: DayNumber): { state: GameState; events: Event[] } {
  const events: Event[] = []
  let bids = state.bids

  // 1. Answers that have come due. Ours only: an offer *to* us waits on the
  //    manager, not on the clock.
  if (bids.some((bid) => bid.status === 'pending' && bid.from === state.managedClubId)) {
    bids = bids.map((bid) => {
      if (bid.status !== 'pending' || bid.from !== state.managedClubId) return bid
      if (bid.answerOn > today) return bid

      const player = (state.squads[bid.to] ?? []).find((p) => p.id === bid.playerId)
      // Sold to someone else while we waited.
      if (player === undefined) {
        events.push({
          type: 'BidAnswered',
          bidId: bid.id,
          playerId: bid.playerId,
          status: 'rejected',
          counterFee: null,
        })
        return { ...bid, status: 'rejected' as const }
      }

      const answer = answerBid(bid, player, today)
      events.push({
        type: 'BidAnswered',
        bidId: bid.id,
        playerId: bid.playerId,
        status: answer.status,
        counterFee: answer.counterFee,
      })
      return { ...bid, status: answer.status, counterFee: answer.counterFee }
    })
  }

  // 2. Offers for our players, on Mondays while the window is open.
  //
  //    This was "the first of a window month", which sounds equivalent and is not:
  //    the clock enters every season on 15 August and `StartNewSeason` jumps
  //    straight to the next 15 August, so **1 July and 1 August are never
  //    reached**. That left exactly one generation day in a whole season, 1
  //    January, producing at most one offer — which is why a manager could play for
  //    years and never be offered anything.
  //
  //    Weekly rather than daily because scoring nineteen clubs against a squad is
  //    not worth doing 380 times a year for an answer that barely moves.
  const offer = isTransferWindowOpen(today) && dayOfWeek(today) === 1 ? bestOfferFor(state) : null
  if (offer !== null && !bids.some((bid) => bid.playerId === offer.playerId && bidIsLive(bid))) {
    const bid: Bid = {
      id: `${offer.playerId}-${today}` as BidId,
      playerId: offer.playerId,
      from: offer.from,
      to: state.managedClubId,
      fee: offer.fee,
      status: 'pending',
      counterFee: null,
      madeOn: today,
      answerOn: today,
    }
    bids = [...bids, bid]
    events.push({
      type: 'OfferReceived',
      bidId: bid.id,
      playerId: bid.playerId,
      from: bid.from,
      fee: bid.fee,
    })
  }

  // 3. Offers to us that were never answered lapse, rather than piling up for a
  //    decade in a headless run where nobody is reading them.
  const lapsed = bids.filter(
    (bid) =>
      bid.to === state.managedClubId &&
      bid.status === 'pending' &&
      today - bid.madeOn >= OFFER_LIFETIME_DAYS,
  )
  if (lapsed.length > 0) {
    const gone = new Set(lapsed.map((bid) => bid.id))
    bids = bids.map((bid) => (gone.has(bid.id) ? { ...bid, status: 'rejected' as const } : bid))
  }

  return { state: bids === state.bids ? state : { ...state, bids }, events }
}

/**
 * The single most interesting offer an AI club would make for one of our spare
 * players, or `null`.
 *
 * One per window day rather than a flood: an inbox of nineteen simultaneous offers
 * is not a decision, it is a chore.
 *
 * **Every spare is a candidate, not just the best ones.** Restricting this to a
 * club's three best spares produced no offers at all, and the reason is worth
 * keeping: a mid-table club's best reserves are not good enough to improve a rich
 * club's XI, and the clubs that would be improved by them cannot afford the fee.
 * The deals that actually exist are the cheap ones at the bottom of the squad.
 */
function bestOfferFor(state: GameState): { playerId: PlayerId; from: ClubId; fee: number } | null {
  const spare = surplus(state.squads[state.managedClubId] ?? [])
  if (spare.length === 0) return null

  const date = state.season.currentDate
  // Derived from the `spare` list already computed rather than via `listedForSale`,
  // which would run `surplus` — a `bestXI` pass plus a check per player — a second
  // time on every generation day.
  const listed = new Set<PlayerId>(state.transferList)
  const onTheMarket = new Set<PlayerId>(
    spare.filter((player) => listed.has(player.id)).map((player) => player.id),
  )
  // Cheapest spare, so a club that cannot afford anybody is skipped before a
  // single `needFor` is computed. This runs seven or so days a season across a
  // fifty-season harness, and `needFor` is two `bestXI` passes.
  const floor = Math.min(...spare.map((player) => askingPrice(player, date)))

  let best: { playerId: PlayerId; from: ClubId; fee: number; need: number } | null = null

  for (const club of state.clubs) {
    if (club.id === state.managedClubId) continue
    if (club.budget < floor) continue
    const squad = state.squads[club.id] ?? []
    if (squad.length >= MAX_SQUAD) continue

    for (const player of spare) {
      const fee = askingPrice(player, date)
      if (club.budget < fee) continue
      const need = needFor(squad, player)
      // A listed player has been advertised, so a club will enquire about him on
      // far less interest than it would take to approach you out of the blue.
      if (need <= (onTheMarket.has(player.id) ? LISTED_NEED_THRESHOLD : OFFER_NEED_THRESHOLD)) {
        continue
      }
      if (best === null || need > best.need)
        best = { playerId: player.id, from: club.id, fee, need }
    }
  }

  return best === null ? null : { playerId: best.playerId, from: best.from, fee: best.fee }
}

/**
 * How badly an AI club must want a player before it offers unprompted. Higher
 * than the AI market's own `NEED_THRESHOLD`: an unsolicited offer is an
 * interruption, and one that arrives for a player nobody really wants trains you
 * to ignore the inbox.
 */
const OFFER_NEED_THRESHOLD = 1.5

/** For a player you have listed. You asked for interest, so less of it is needed. */
const LISTED_NEED_THRESHOLD = 0.4

/**
 * What you charge at the gate.
 *
 * Managed club only. Range-checked here rather than in the screen for the same
 * reason `SetTactics` is: a screen can forget a rule, and this cannot.
 */
function setTicketPrice(state: GameState, command: SetTicketPrice): ReduceResult {
  const low = FINANCE.TICKET * FINANCE.MIN_TICKET_FACTOR
  const high = FINANCE.TICKET * FINANCE.MAX_TICKET_FACTOR

  if (!Number.isFinite(command.price) || command.price < low || command.price > high) {
    throw new Error(`A ticket must be priced between ${String(low)} and ${String(high)}`)
  }

  return {
    state: {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.managedClubId ? { ...club, ticketPrice: command.price } : club,
      ),
    },
    events: [{ type: 'TicketPriceSet', price: command.price }],
  }
}

/**
 * Commission building work.
 *
 * Paid immediately and delivered at the rollover, which is the whole point — the
 * money leaves before you know whether the seats were needed. One job at a time:
 * a club stacking three expansions would be spending its way out of the decision
 * rather than making it.
 */
function startExpansion(state: GameState, command: StartExpansion): ReduceResult {
  const club = state.clubs.find((c) => c.id === state.managedClubId)
  /* c8 ignore next */
  if (club === undefined) throw new Error('No managed club')

  if (club.expansion !== null) throw new Error('Building work is already under way')
  if (
    !Number.isFinite(command.seats) ||
    command.seats < FINANCE.MIN_EXPANSION ||
    command.seats > FINANCE.MAX_EXPANSION
  ) {
    throw new Error(
      `An expansion runs from ${String(FINANCE.MIN_EXPANSION)} to ${String(FINANCE.MAX_EXPANSION)} seats`,
    )
  }

  const cost = expansionCost(command.seats)
  if (!affordable(state, club, cost)) {
    throw new Error('That would take you past your overdraft limit')
  }

  // Seats are ready for the season after this one.
  const readyYear = state.season.startYear + 1

  return {
    state: {
      ...state,
      clubs: state.clubs.map((c) =>
        c.id !== club.id
          ? c
          : {
              ...c,
              // Building money leaves the league, like a signing bonus — so it is
              // a ledger line, and the balance moves by exactly that line.
              budget: c.budget - cost,
              ledger: credit(c.ledger, 'stadium', cost),
              expansion: { seats: command.seats, readyYear },
            },
      ),
    },
    events: [{ type: 'ExpansionStarted', seats: command.seats, cost, readyYear }],
  }
}

/**
 * Whether a club can commit to an outlay, counting the signing bonus.
 *
 * Home games per club is `ROUNDS_PER_HALF` — nineteen in a twenty-club league —
 * which is what sizes the overdraft against a season's gate.
 */
function affordable(state: GameState, club: Club, fee: number): boolean {
  const outlay = fee + Math.round(fee * FINANCE.SIGNING_BONUS)
  return canAfford(club, outlay, state.competition.clubIds.length, ROUNDS_PER_HALF)
}

/**
 * The day's money. Gate receipts when a home match is played, and everything
 * else on the first of the month.
 *
 * **Draws no randomness, and must never begin to.** This runs inside
 * `AdvanceDay`, the path every calibrated distribution band in the project is
 * measured through, so one `rng.next()` here would shift every downstream draw
 * and move every band at once — the same rule the bid subsystem lives under.
 * Attendance is therefore a function of quality and league position rather than
 * a draw, which is also the more legible model: a crowd is not a coin flip.
 *
 * Returns the state unchanged on the ~300 days a year when neither a match nor a
 * settlement falls, so the common tick costs one boolean and a length check.
 *
 * **TV merit keys off the current table rather than last season's finish.** That
 * is an approximation, taken to avoid carrying last season's positions as a
 * second piece of state: in August nothing has been played, so every club takes
 * the flat share, and the merit component converges on the finishing order as
 * the season runs. Averaged over a season it lands in the same place, and money
 * following current form is arguably the better game anyway.
 */
function settleFinances(
  state: GameState,
  today: DayNumber,
  fixtures: readonly Fixture[],
): GameState {
  const settling = isSettlementDay(today)
  const hosted = fixtures.filter((f) => f.date <= today && f.result !== null && f.date === today)
  if (!settling && hosted.length === 0) return state

  const clubCount = state.competition.clubIds.length
  const positions = positionsFrom(state.competition.clubIds, fixtures)
  const byId = new Map(state.clubs.map((club) => [club.id, club]))

  const gate = new Map<ClubId, number>()
  for (const fixture of hosted) {
    const home = byId.get(fixture.homeId)
    /* c8 ignore next */
    if (home === undefined) continue
    const taken = gateReceipts(home, positions?.get(home.id) ?? null, clubCount)
    gate.set(home.id, (gate.get(home.id) ?? 0) + taken)
  }

  const clubs = state.clubs.map((club) => {
    let ledger = club.ledger
    const taken = gate.get(club.id) ?? 0
    if (taken > 0) ledger = credit(ledger, 'gate', taken)

    if (settling) {
      const month = monthlyLines(
        club,
        state.squads[club.id] ?? [],
        positions?.get(club.id) ?? null,
        clubCount,
        ROUNDS_PER_HALF,
      )
      ledger = credit(ledger, 'tv', month.tv)
      ledger = credit(ledger, 'sponsor', month.sponsor)
      ledger = credit(ledger, 'wages', month.wages)
      ledger = credit(ledger, 'interest', month.interest)
    }

    if (ledger === club.ledger) return club
    // The balance moves by exactly what the ledger gained — that identity is the
    // invariant, and computing the delta any other way is how it drifts.
    return { ...club, budget: club.budget + ledgerNet(ledger) - ledgerNet(club.ledger), ledger }
  })

  return { ...state, clubs }
}

function advanceDay(state: GameState, rng: Rng): ReduceResult {
  const today = state.season.currentDate
  const wasComplete = isSeasonComplete(state)
  const market = tickMarket(state, today)
  state = market.state
  const events: Event[] = [...market.events]

  // Ratings come from each club's selected XI and tactics — the collapse specified
  // in docs/attribute-model.md. `resolveFixture` is unchanged from M2; M3 replaced
  // the supplier, not the signature, which is what the TeamRating parameter was for.
  const ratings = new Map<ClubId, TeamRating>(
    state.clubs.map((club) => {
      const squad = state.squads[club.id] ?? []
      const lineup = state.lineups[club.id]
      /* c8 ignore next */
      if (lineup === undefined) throw new Error(`No lineup selected for ${club.id}`)
      return [club.id, teamRating(startersOf(squad, lineup), state.tactics[club.id] ?? BALANCED)]
    }),
  )

  // Resolve everything *due* — not merely everything dated today. An exact date
  // match silently drops any fixture the clock has already passed, and anything
  // that jumps the clock produces exactly that: "continue to next match" is a
  // standard manager feature, and postponements arrive at M7.
  //
  // Fixtures are walked in stored order so rng draws happen in a fixed sequence —
  // the same seed must always produce the same season.
  const played = state.season.fixtures.map((fixture) => {
    if (fixture.date > today || fixture.result !== null) return fixture

    const home = ratings.get(fixture.homeId)
    const away = ratings.get(fixture.awayId)
    /* c8 ignore next */
    if (home === undefined || away === undefined) return fixture

    const score = resolveFixture(home, away, rng)
    events.push({
      type: 'MatchPlayed',
      fixtureId: fixture.id,
      round: fixture.round,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      score,
    })
    return { ...fixture, result: score }
  })

  const next: GameState = settleFinances(
    {
      ...state,
      season: {
        ...state.season,
        currentDate: addDays(today, 1),
        fixtures: played,
      },
    },
    today,
    played,
  )

  events.push({ type: 'DayAdvanced', date: next.season.currentDate })

  // Emitted once, on the transition — not on every subsequent day.
  if (!wasComplete && isSeasonComplete(next)) {
    events.push({ type: 'SeasonEnded', startYear: next.season.startYear })
    return { state: closeWithBoard(next, events), events }
  }

  return { state: next, events }
}

/**
 * The board's verdict, on the day the season ends.
 *
 * Here rather than in `StartNewSeason` because this is the moment the season
 * actually finishes — which means the hub can show you the judgement *before*
 * you press on into the summer, and a dismissal is not something you discover by
 * clicking "start next season".
 *
 * **Deliberately placed differently from M5a's `settleSeason`**, which had to
 * live in `rolloverSeason` so the headless career ran the same economy the game
 * does. Money changes how clubs behave; the board changes nothing about how
 * anybody plays, so a harness career that is never judged still measures exactly
 * the same football. It draws no randomness, for the usual reason.
 */
function closeWithBoard(state: GameState, events: Event[]): GameState {
  const positions = positionsFrom(state.competition.clubIds, state.season.fixtures)
  const finish = positions?.get(state.managedClubId)
  /* c8 ignore next */
  if (finish === undefined) return state

  const verdict = judge(state.board, finish, state.managedClubId, state.clubs)
  events.push({
    type: 'BoardVerdict',
    startYear: state.season.startYear,
    target: state.board.target,
    finish,
    met: verdict.met,
    strikes: verdict.board.strikes,
    dismissed: verdict.dismissed,
  })

  return { ...state, board: verdict.board }
}
