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
import { GameError } from './errors.ts'
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
  signingOutlay,
} from './finance.ts'
import { ROUNDS_PER_HALF } from './fixtures.ts'
import type { Country } from './foreign.ts'
import { BALANCED, type Lineup, startersOf, type Tactics, teamRating } from './lineup.ts'
import {
  aiSaleRefusal,
  applyTransfers,
  isTransferWindowOpen,
  MAX_SQUAD,
  needFor,
  reluctancePremium,
  runTransferWindow,
  saleBlock,
  sellable,
  transferWindowChange,
  transferWindowDaysLeft,
  WINDOW_WARNING_DAYS,
} from './market.ts'
import {
  ageOn,
  CONTRACT_WARNING_DAYS,
  contractExpiry,
  type Player,
  type PlayerId,
} from './player.ts'
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
  /**
   * Name pools per country, for the youngsters who replace departures abroad.
   * Same reasoning as `names`: `domain` owns no word lists. Optional, because a
   * career with no foreign clubs has nobody to name.
   */
  readonly foreignNames?: Readonly<Record<Country, readonly string[]>>
  /** What each foreign club is seeded to hold, so balances abroad do not compound. */
  readonly foreignBudgets?: Readonly<Record<string, number>>
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

/**
 * New terms for a player already yours.
 *
 * Deliberately *not* gated on the transfer window. A deadline exists to protect
 * the clubs you would be buying from; renewing your own player involves nobody
 * else, and the rollover judges his deal whether or not a window is open.
 */
export interface RenewContract {
  readonly type: 'RenewContract'
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
  | RenewContract
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

/** One of yours signed again. `years` is the length agreed, not the year it ends. */
export interface ContractRenewed {
  readonly type: 'ContractRenewed'
  readonly playerId: PlayerId
  readonly wage: number
  readonly years: number
}

/**
 * One of your deals runs out at the end of this season. Emitted once per contract,
 * on the day the count passes `CONTRACT_WARNING_DAYS` exactly.
 */
export interface ContractExpiring {
  readonly type: 'ContractExpiring'
  readonly playerId: PlayerId
}

/**
 * He came to the end of his deal and the club did not renew it, so he left for
 * nothing. Managed club only — nineteen other clubs shedding players every summer
 * would bury the feed.
 *
 * **Carries his name.** A released player is in `freeAgents`, so `lookupFor` would
 * in fact still find him — but `PlayerRetired` beside it genuinely cannot be looked
 * up, and a pair of events describing the same moment should not resolve their
 * subject by two different routes.
 */
export interface PlayerReleased {
  readonly type: 'PlayerReleased'
  readonly playerId: PlayerId
  readonly name: string
}

/**
 * He hung up the boots at the rollover. Managed club only.
 *
 * **The name is not optional here.** `lookupFor` builds its map from every squad
 * plus the free-agent pool, and a retired player is in neither — he is gone from
 * the state entirely, so an id alone would render as "unknown player".
 */
export interface PlayerRetired {
  readonly type: 'PlayerRetired'
  readonly playerId: PlayerId
  readonly name: string
  readonly age: number
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

/**
 * The transfer window opened or closed.
 *
 * Emitted wherever the date moves — the day tick and the season rollover both — because
 * the window is a predicate over the date and the rollover jumps clean over July.
 */
export interface TransferWindowChanged {
  readonly type: 'TransferWindowChanged'
  readonly open: boolean
  readonly date: DayNumber
}

/**
 * The deadline is close. Emitted once per window, not once a day.
 *
 * Only the day tick emits this. The rollover lands on 15 August with the whole
 * window ahead of it, so there is nothing to warn about there.
 */
export interface TransferWindowClosing {
  readonly type: 'TransferWindowClosing'
  readonly daysLeft: number
  readonly date: DayNumber
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
  | ContractRenewed
  | ContractExpiring
  | PlayerReleased
  | PlayerRetired
  | PlayerListed
  | TransferCompleted
  | BoardVerdict
  | TicketPriceSet
  | ExpansionStarted
  | ExpansionOpened
  | TransferWindowChanged
  | TransferWindowClosing

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
    case 'RenewContract':
      return renewContract(state, command)
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
    throw new GameError(
      'error.tactics.range',
      `Tactics must sit between 0 and 100, got ${attacking}`,
    )
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
    throw new GameError('error.season.notOver', 'The season is not over yet')
  }

  const rolled = rolloverSeason(state, rng, {
    names: command.names,
    ...(command.foreignNames === undefined ? {} : { foreignNames: command.foreignNames }),
    ...(command.foreignBudgets === undefined ? {} : { foreignBudgets: command.foreignBudgets }),
  })
  const transfers = runTransferWindow(rolled, rng, { exclude: rolled.managedClubId })
  const next = applyTransfers(rolled, transfers)

  const events: Event[] = [{ type: 'SeasonStarted', startYear: next.season.startYear }]

  // The rollover jumps from the end of one season to 15 August of the next, so it
  // steps clean over July — this is the *only* path on which the summer window is
  // ever seen to open. Watching the day tick alone would announce January and
  // nothing else.
  const summer = transferWindowChange(state.season.currentDate, next.season.currentDate)
  if (summer !== null) {
    events.push({ type: 'TransferWindowChanged', open: summer, date: next.season.currentDate })
  }

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

  // Who left your squad over the summer, and why.
  //
  // Both are read off `rolled` rather than `next`, and the ordering is
  // load-bearing: the AI window runs in this same handler, so a player sold in it
  // would otherwise be counted as released and reported twice — once here and once
  // as a `TransferCompleted` below.
  //
  // This is derived by diffing rather than reported by `rolloverSeason`, which
  // keeps that function's signature and its rng draw count untouched. It is called
  // directly by `simulateCareer`, so a change there is a change to every
  // calibrated band in the project.
  for (const gone of departures(state, rolled)) events.push(gone)

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

/**
 * Everyone who was in your squad before the rollover and is not in it after.
 *
 * Two fates, told apart by where he ended up: the free-agent pool means the club
 * declined to renew an expiring deal, and nowhere at all means he retired. Until
 * this existed both were silent — a player was simply gone from the list the next
 * time you looked, which is the least a season rollover should be able to say.
 *
 * Managed club only. Nineteen other clubs shed players every summer too, and
 * reporting them would bury everything worth reading.
 */
function departures(before: GameState, after: GameState): readonly Event[] {
  const kept = new Set((after.squads[after.managedClubId] ?? []).map((p) => p.id))
  const free = new Set(after.freeAgents.map((p) => p.id))
  const events: Event[] = []

  for (const player of before.squads[before.managedClubId] ?? []) {
    if (kept.has(player.id)) continue
    events.push(
      free.has(player.id)
        ? { type: 'PlayerReleased', playerId: player.id, name: player.name }
        : {
            type: 'PlayerRetired',
            playerId: player.id,
            name: player.name,
            // His age on the day he stopped, which is the rollover's own reference
            // date rather than the last day of the season just finished.
            age: ageOn(player, after.season.currentDate),
          },
    )
  }

  return events
}

/** Locates a player anywhere in the game, and who holds him. */
function findPlayer(
  state: GameState,
  playerId: PlayerId,
): { player: Player; club: ClubId | null } | null {
  for (const club of state.clubs) {
    const player = (state.squads[club.id] ?? []).find((p) => p.id === playerId)
    if (player !== undefined) return { player, club: club.id }
  }
  // Abroad counts as "somebody holds him", so a bid for a foreign player goes
  // through every gate a domestic one does — `aiSaleRefusal` and
  // `reluctancePremium` take a squad rather than a club, so neither needed a line.
  for (const club of state.foreign.clubs) {
    const player = (state.foreign.squads[club.id] ?? []).find((p) => p.id === playerId)
    if (player !== undefined) return { player, club: club.id }
  }
  const free = state.freeAgents.find((p) => p.id === playerId)
  return free === undefined ? null : { player: free, club: null }
}

/** The squad holding this club's players, wherever the club is. */
function squadOfAnyClub(state: GameState, clubId: ClubId): readonly Player[] {
  return state.squads[clubId] ?? state.foreign.squads[clubId] ?? []
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

  if (!isTransferWindowOpen(date))
    throw new GameError('error.window.closed', 'The transfer window is closed')

  const found = findPlayer(state, command.playerId)
  if (found === null)
    throw new GameError('error.player.unknown', `No such player: ${command.playerId}`)
  if (found.club === null) {
    throw new GameError(
      'error.player.freeAgent',
      'A free agent costs no fee — offer him a contract instead',
    )
  }
  if (found.club === state.managedClubId)
    throw new GameError('error.player.yours', 'He is already yours')

  // Every player has a price. What used to sit here was `surplus` membership,
  // which made anyone in a club's best XI unbuyable **at any figure** while the AI
  // stayed free to offer for anyone of yours who was merely out of your team
  // sheet. The only refusals left are the two that protect the seller's squad;
  // what he would rather keep is priced instead, by `reluctancePremium`.
  const sellerSquad = squadOfAnyClub(state, found.club)
  const refusal = aiSaleRefusal(sellerSquad, found.player)
  if (refusal === 'squadFloor') {
    throw new GameError(
      'error.player.squadFloor',
      `${found.player.name}'s club has too small a squad to sell anybody`,
      { player: found.player.name },
    )
  }
  if (refusal === 'shape') {
    throw new GameError(
      'error.player.lastAtPosition',
      `${found.player.name} is the last ${found.player.position} his club can spare`,
      // The position is in the English sentence but deliberately not a parameter:
      // it would arrive at a Catalan dictionary as the bare code `GK`.
      { player: found.player.name },
    )
  }

  if (!Number.isFinite(command.fee) || command.fee <= 0) {
    throw new GameError('error.bid.positive', `A bid must be a positive fee, got ${command.fee}`)
  }
  // Checked against the overdraft, not the balance: a manager may spend into
  // debt, which is the whole point of the limit existing. The AI may not — see
  // `runTransferWindow`.
  if (!affordable(state, buyer, command.fee)) {
    throw new GameError('error.bid.overdraft', 'That would take you past your overdraft limit')
  }
  if ((state.squads[state.managedClubId] ?? []).length >= MAX_SQUAD) {
    throw new GameError('error.squad.full', 'Your squad is full')
  }
  if (liveBidFor(state, command.playerId) !== undefined) {
    throw new GameError('error.bid.live', `There is already a live bid for ${found.player.name}`, {
      player: found.player.name,
    })
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
  if (bid === undefined) throw new GameError('error.bid.unknown', `No such bid: ${command.bidId}`)
  if (bid.from !== state.managedClubId)
    throw new GameError('error.bid.notYours', 'That is not your bid')

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
  if (!isTransferWindowOpen(date))
    throw new GameError('error.window.closed', 'The transfer window is closed')

  const found = findPlayer(state, command.playerId)
  if (found === null)
    throw new GameError('error.player.unknown', `No such player: ${command.playerId}`)

  const bid = found.club === null ? undefined : liveBidFor(state, command.playerId)
  if (found.club !== null && (bid === undefined || bid.status !== 'accepted')) {
    throw new GameError('error.contract.noFee', `No agreed fee for ${found.player.name}`, {
      player: found.player.name,
    })
  }
  if (found.club === state.managedClubId)
    throw new GameError('error.player.yours', 'He is already yours')

  if (!Number.isInteger(command.years)) {
    throw new GameError(
      'error.contract.wholeYears',
      `Contract length must be whole years, got ${command.years}`,
    )
  }
  if (command.years < MIN_CONTRACT_YEARS || command.years > MAX_CONTRACT_YEARS) {
    throw new GameError(
      'error.contract.range',
      `A contract runs ${MIN_CONTRACT_YEARS}–${MAX_CONTRACT_YEARS} years, got ${command.years}`,
      { min: MIN_CONTRACT_YEARS, max: MAX_CONTRACT_YEARS },
    )
  }
  if (!Number.isFinite(command.wage) || command.wage < 0) {
    throw new GameError(
      'error.contract.negativeWage',
      `A wage cannot be negative, got ${command.wage}`,
    )
  }
  if ((state.squads[state.managedClubId] ?? []).length >= MAX_SQUAD) {
    throw new GameError('error.squad.full', 'Your squad is full')
  }

  const fee = bid?.fee ?? 0
  const buyer = state.clubs.find((c) => c.id === state.managedClubId)
  /* c8 ignore next */
  if (buyer === undefined) throw new Error('No managed club')
  if (!affordable(state, buyer, fee)) {
    throw new GameError('error.bid.overdraft', 'That would take you past your overdraft limit')
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

/**
 * New terms for a player already yours.
 *
 * `offerContract` minus the transfer: no fee, no `applyTransfers`, no money. What
 * it keeps is the part that matters — the player still has to accept, judged by
 * the same `offerTerms` a signing goes through, so a renewal is a negotiation
 * rather than a button that always works.
 *
 * **Three clauses differ from `offerContract` and each is deliberate.** There is no
 * window check, because a deadline protects the club you would be buying from and
 * there is no such club here. `found.club === managedClubId` is required rather
 * than forbidden. And the new deal may not be shorter than the one he is on: with
 * renewal available at any moment, offering one year to a man contracted to 2031
 * would quietly cut four years off him, which is a slip rather than a decision.
 */
function renewContract(state: GameState, command: RenewContract): ReduceResult {
  const date = state.season.currentDate
  const squad = state.squads[state.managedClubId] ?? []
  const player = squad.find((p) => p.id === command.playerId)

  if (player === undefined) {
    throw new GameError('error.renew.notYours', `${command.playerId} is not one of yours`)
  }
  if (!Number.isInteger(command.years)) {
    throw new GameError(
      'error.contract.wholeYears',
      `A contract runs a whole number of years, got ${command.years}`,
    )
  }
  if (command.years < MIN_CONTRACT_YEARS || command.years > MAX_CONTRACT_YEARS) {
    throw new GameError(
      'error.contract.range',
      `A contract runs ${MIN_CONTRACT_YEARS}–${MAX_CONTRACT_YEARS} years, got ${command.years}`,
      { min: MIN_CONTRACT_YEARS, max: MAX_CONTRACT_YEARS },
    )
  }
  if (!Number.isFinite(command.wage) || command.wage < 0) {
    throw new GameError(
      'error.contract.negativeWage',
      `A wage cannot be negative, got ${command.wage}`,
    )
  }

  const until = contractExpiry(state.season.startYear + command.years)
  if (until <= player.contract.until) {
    throw new GameError(
      'error.renew.shorter',
      `${player.name} is already contracted at least that long`,
      { player: player.name },
    )
  }

  const verdict = offerTerms(player, { wage: command.wage, years: command.years }, date)
  if (!verdict.accepted) {
    // A refusal is an outcome, not a mistake — the state is untouched so the terms
    // can be improved. `TermsRejected` is reused rather than duplicated: it already
    // says who, why, and what he would sign for, and the feed already has a
    // sentence for it.
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

  const renewed = squad.map((p) =>
    p.id === command.playerId ? { ...p, contract: { until, wage: Math.round(command.wage) } } : p,
  )

  return {
    state: { ...state, squads: { ...state.squads, [state.managedClubId]: renewed } },
    events: [
      {
        type: 'ContractRenewed',
        playerId: command.playerId,
        wage: Math.round(command.wage),
        years: command.years,
      },
    ],
  }
}

/** Accept or reject an AI club's offer for one of yours. */
function respondToOffer(state: GameState, command: RespondToOffer): ReduceResult {
  const bid = state.bids.find((b) => b.id === command.bidId)
  if (bid === undefined) throw new GameError('error.bid.unknown', `No such bid: ${command.bidId}`)
  if (bid.to !== state.managedClubId)
    throw new GameError('error.offer.notYours', 'That offer is not yours to answer')
  if (!bidIsLive(bid))
    throw new GameError('error.offer.settled', 'That offer has already been settled')

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

  // Re-checked at acceptance rather than trusted from when the offer was made: he
  // may have been picked since, and accepting would then sell a man out of the XI
  // on the team sheet.
  const squad = state.squads[state.managedClubId] ?? []
  const wanted = squad.find((p) => p.id === bid.playerId)
  if (
    wanted === undefined ||
    saleBlock(squad, state.lineups[state.managedClubId], wanted) !== null
  ) {
    throw new GameError('error.offer.cannotSpare', 'You can no longer spare him')
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
 * **There is a second notion of "spare" for the human, and this is where it is
 * enforced.** This used to run the AI's `surplus` on the argument that one rule was
 * better than two — but `surplus` judges against a fixed 4-4-2, so a manager
 * playing any other shape was told a man on his own bench was "in your first team"
 * while the row beside the button read "not selected". `saleBlock` asks the two
 * questions that are actually true of him: is he in the XI you picked, and would
 * selling him leave you one goalkeeper.
 *
 * Selling is still squad management rather than asset-stripping — you cannot strip
 * out the team sheet you just wrote. That part never changed.
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
  if (player === undefined)
    throw new GameError('error.list.notYours', 'You can only list your own players')

  const block = saleBlock(squad, state.lineups[state.managedClubId], player)
  if (block === 'lineup') {
    throw new GameError(
      'error.list.firstTeam',
      `${player.name} is in your first team — you cannot list him`,
      { player: player.name },
    )
  }
  if (block === 'coverKeeper') {
    throw new GameError(
      'error.list.coverKeeper',
      `Selling ${player.name} would leave you with one goalkeeper`,
      { player: player.name },
    )
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

      const sellerSquad = squadOfAnyClub(state, bid.to)
      const player = sellerSquad.find((p) => p.id === bid.playerId)
      // Sold to someone else while we waited, or his club can no longer let him
      // go — a squad that has shrunk since the bid was made refuses whatever the
      // fee. **Re-checked here rather than trusted from `makeBid`**, which is the
      // same discipline `respondToOffer` and `runTransferWindow`'s buy loop use:
      // an answer lands two days later and a squad moves in between.
      if (player === undefined || aiSaleRefusal(sellerSquad, player) !== null) {
        events.push({
          type: 'BidAnswered',
          bidId: bid.id,
          playerId: bid.playerId,
          status: 'rejected',
          counterFee: null,
        })
        return { ...bid, status: 'rejected' as const }
      }

      // The premium is computed now, not when the bid was made, for the same
      // reason. Two `bestXI` passes for the handful of bids answered on a given
      // day — negligible beside the nineteen-club `bestOfferFor` sweep already
      // running every Monday, and it draws nothing.
      const answer = answerBid(bid, player, today, reluctancePremium(sellerSquad, player))
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
  // The manager's own rule, so a club cannot offer for a man he is not allowed to
  // sell — an offer he could only ever refuse is noise in an inbox that exists to
  // carry decisions.
  const spare = sellable(
    state.squads[state.managedClubId] ?? [],
    state.lineups[state.managedClubId],
  )
  if (spare.length === 0) return null

  const date = state.season.currentDate
  // Derived from the `spare` list already computed rather than via `listedForSale`,
  // which would run the whole sale rule a second time on every generation day.
  const listed = new Set<PlayerId>(state.transferList)
  const onTheMarket = new Set<PlayerId>(
    spare.filter((player) => listed.has(player.id)).map((player) => player.id),
  )
  // Cheapest spare, so a club that cannot afford anybody is skipped before a
  // single `needFor` is computed. This runs seven or so days a season across a
  // fifty-season harness, and `needFor` is two `bestXI` passes.
  const floor = Math.min(...spare.map((player) => askingPrice(player, date)))

  let best: { playerId: PlayerId; from: ClubId; fee: number; need: number } | null = null

  // Clubs abroad make offers too, and it is much of what makes the layer felt: a
  // foreign club coming in for one of yours is the first thing a manager notices
  // about it. Same score, same threshold, same fee.
  for (const club of [...state.clubs, ...state.foreign.clubs]) {
    if (club.id === state.managedClubId) continue
    if (club.budget < floor) continue
    const squad = squadOfAnyClub(state, club.id)
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
const OFFER_NEED_THRESHOLD = 1.0

/** For a player you have listed. You asked for interest, so less of it is needed. */
const LISTED_NEED_THRESHOLD = 0.5

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
    throw new GameError(
      'error.ticket.range',
      `A ticket must be priced between ${String(low)} and ${String(high)}`,
      { low: String(low), high: String(high) },
    )
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

  if (club.expansion !== null)
    throw new GameError('error.expansion.underWay', 'Building work is already under way')
  if (
    !Number.isFinite(command.seats) ||
    command.seats < FINANCE.MIN_EXPANSION ||
    command.seats > FINANCE.MAX_EXPANSION
  ) {
    throw new GameError(
      'error.expansion.range',
      `An expansion runs from ${String(FINANCE.MIN_EXPANSION)} to ${String(FINANCE.MAX_EXPANSION)} seats`,
      { min: FINANCE.MIN_EXPANSION, max: FINANCE.MAX_EXPANSION },
    )
  }

  const cost = expansionCost(command.seats)
  if (!affordable(state, club, cost)) {
    throw new GameError('error.bid.overdraft', 'That would take you past your overdraft limit')
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
  return canAfford(club, signingOutlay(fee), state.competition.clubIds.length, ROUNDS_PER_HALF)
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

  // The tick crosses 31 Dec → 1 Jan and 31 Jan → 1 Feb. It never crosses into July,
  // which is why `StartNewSeason` watches for the same change across its jump.
  const window = transferWindowChange(today, next.season.currentDate)
  if (window !== null) {
    events.push({ type: 'TransferWindowChanged', open: window, date: next.season.currentDate })
  }

  // Exact equality is what makes this fire once. The tick moves a single day, so the
  // count passes through the threshold exactly once per window — a `<=` would report
  // the deadline every day for a week, which is the shape of feed nobody reads.
  const left = transferWindowDaysLeft(next.season.currentDate)
  if (left === WINDOW_WARNING_DAYS) {
    events.push({ type: 'TransferWindowClosing', daysLeft: left, date: next.season.currentDate })
  }

  // Your own deals running out this summer, announced far enough ahead to sell or
  // renew. Exact equality for the same reason the window warning above uses it: the
  // tick moves one day, so a contract passes through the threshold once and only
  // once, where a `<=` would repeat every name every day for six months.
  //
  // Because a contract always expires on a 30 June, counting back from `until`
  // lands on 30 December — inside the season, and reachable. Anything keyed on the
  // *calendar* rather than on the contract risks July, which the clock never
  // enters; that fact has cost this project three separate defects.
  for (const player of next.squads[next.managedClubId] ?? []) {
    if (player.contract.until - next.season.currentDate === CONTRACT_WARNING_DAYS) {
      events.push({ type: 'ContractExpiring', playerId: player.id })
    }
  }

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
